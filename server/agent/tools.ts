import { spawn } from "child_process"
import fs from "fs/promises"
import path from "path"
import { z } from "zod"
import { TaskManager } from "@/server/agent/Task"
import { defineTool } from "@/server/agent/Tool"

const BASH_MAX_OUTPUT = 10_000
const SEARCH_MAX_LINES = 100

type ProcessResult = {
  stdout: string
  stderr: string
  exitCode: number
}

async function runProcess(
  command: string,
  args: string[],
  options: { cwd: string; timeoutMs: number }
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: false,
      env: { ...process.env, TERM: "xterm-256color" },
    })

    let stdout = ""
    let stderr = ""
    let killedByTimeout = false

    const timer = setTimeout(() => {
      killedByTimeout = true
      child.kill("SIGTERM")
    }, options.timeoutMs)

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })

    child.on("error", (error) => {
      clearTimeout(timer)
      reject(error)
    })

    child.on("close", (code) => {
      clearTimeout(timer)
      if (killedByTimeout) {
        resolve({
          stdout,
          stderr: `${stderr}\nProcess timed out after ${options.timeoutMs}ms`.trim(),
          exitCode: 124,
        })
        return
      }

      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
      })
    })
  })
}

export function createAgentTools(taskManager: TaskManager) {
  return [
    defineTool({
      name: "Read",
      description:
        "Read a file from the local filesystem. Returns content with line numbers. Use this to understand existing code before making changes.",
      inputSchema: z.object({
        file_path: z
          .string()
          .describe("Absolute path or path relative to project root"),
        offset: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe("Line number to start reading from (0-indexed)"),
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Number of lines to read. Defaults to 2000."),
      }),
      execute: async ({ file_path, offset, limit }, context) => {
        try {
          const resolved = context.resolvePath(file_path)
          const content = await fs.readFile(resolved, "utf-8")
          const lines = content.split("\n")
          const start = offset ?? 0
          const end = Math.min(start + (limit ?? 2000), lines.length)
          const numbered = lines
            .slice(start, end)
            .map((line, index) => `${start + index + 1}\t${line}`)
            .join("\n")

          return {
            content: numbered,
            totalLines: lines.length,
            truncated: end < lines.length,
          }
        } catch (error) {
          return { error: (error as Error).message }
        }
      },
    }),
    defineTool({
      name: "Write",
      description:
        "Write content to a file. Creates the file if it doesn't exist, overwrites if it does. Use for NEW files or complete rewrites. Prefer Edit for modifying existing files.",
      inputSchema: z.object({
        file_path: z.string().describe("File path to write to"),
        content: z.string().describe("Full file content to write"),
      }),
      execute: async ({ file_path, content }, context) => {
        try {
          const resolved = context.resolvePath(file_path)
          await fs.mkdir(path.dirname(resolved), { recursive: true })
          await fs.writeFile(resolved, content, "utf-8")

          return {
            success: true,
            path: resolved,
            linesWritten: content.split("\n").length,
          }
        } catch (error) {
          return { error: (error as Error).message }
        }
      },
    }),
    defineTool({
      name: "Edit",
      description:
        "Make targeted string replacements in a file. The old_string must match exactly (including whitespace/indentation). Use replace_all to replace every occurrence. ALWAYS read the file first before editing.",
      inputSchema: z.object({
        file_path: z.string().describe("File path to edit"),
        old_string: z
          .string()
          .describe("The exact string to find and replace"),
        new_string: z.string().describe("The replacement string"),
        replace_all: z
          .boolean()
          .optional()
          .describe("Replace all occurrences (default false)"),
      }),
      execute: async ({ file_path, old_string, new_string, replace_all }, context) => {
        try {
          const resolved = context.resolvePath(file_path)
          const content = await fs.readFile(resolved, "utf-8")

          if (!content.includes(old_string)) {
            return { error: "old_string not found in file" }
          }

          const updated = replace_all
            ? content.replaceAll(old_string, new_string)
            : content.replace(old_string, new_string)

          await fs.writeFile(resolved, updated, "utf-8")
          return { success: true }
        } catch (error) {
          return { error: (error as Error).message }
        }
      },
    }),
    defineTool({
      name: "Bash",
      description:
        "Execute a shell command in the project directory. Use for: running tests, building, linting, git operations, installing packages, running scripts. Do NOT use for grep/find/cat - use Grep, Glob, Read instead.",
      inputSchema: z.object({
        command: z.string().describe("The shell command to execute"),
        description: z
          .string()
          .optional()
          .describe("Brief description of what this command does"),
        timeout: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Timeout in milliseconds (max 120000, default 30000)"),
      }),
      execute: async ({ command, timeout }, context) => {
        const task = taskManager.start("local_bash", command)

        try {
          const timeoutMs = Math.min(timeout ?? 30_000, 120_000)
          const result = await runProcess("/bin/zsh", ["-lc", command], {
            cwd: context.projectPath || context.defaultCwd,
            timeoutMs,
          })

          if (result.exitCode === 0) {
            taskManager.complete(task.id)
          } else {
            taskManager.fail(task.id)
          }

          const output = result.stdout || result.stderr
          if (output.length > BASH_MAX_OUTPUT) {
            return {
              output: output.slice(0, BASH_MAX_OUTPUT),
              truncated: true,
              totalLength: output.length,
              exitCode: result.exitCode,
              taskId: task.id,
            }
          }

          return {
            output,
            truncated: false,
            exitCode: result.exitCode,
            taskId: task.id,
          }
        } catch (error) {
          taskManager.fail(task.id)
          return {
            error: (error as Error).message,
            taskId: task.id,
          }
        }
      },
    }),
    defineTool({
      name: "Glob",
      description:
        "Fast file pattern matching. Find files by name/path pattern. Supports glob patterns like '**/*.ts', 'src/**/*.tsx'. Returns matching file paths.",
      inputSchema: z.object({
        pattern: z.string().describe("Glob pattern to match files against"),
        path: z
          .string()
          .optional()
          .describe("Directory to search in. Defaults to project root."),
      }),
      execute: async ({ pattern, path: searchPath }, context) => {
        try {
          const cwd = searchPath
            ? context.resolvePath(searchPath)
            : context.projectPath || context.defaultCwd

          const result = await runProcess(
            "rg",
            [
              "--files",
              "--glob",
              pattern,
              "--glob",
              "!**/node_modules/**",
              "--glob",
              "!**/.git/**",
            ],
            { cwd, timeoutMs: 10_000 }
          )

          const files = result.stdout
            .trim()
            .split("\n")
            .filter(Boolean)
            .slice(0, SEARCH_MAX_LINES)

          return {
            files,
            count: files.length,
            truncated: files.length >= SEARCH_MAX_LINES,
          }
        } catch (error) {
          return { error: (error as Error).message }
        }
      },
    }),
    defineTool({
      name: "Grep",
      description:
        "Search file contents using ripgrep. Supports regex, file type filtering, context lines, and multiple output modes. Use this instead of Bash grep/rg.",
      inputSchema: z.object({
        pattern: z
          .string()
          .describe("Regex pattern to search for in file contents"),
        path: z
          .string()
          .optional()
          .describe("File or directory to search in. Defaults to project root."),
        glob: z
          .string()
          .optional()
          .describe('Glob to filter files (e.g. "*.ts", "*.{ts,tsx}")'),
        output_mode: z
          .enum(["content", "files_with_matches", "count"])
          .optional()
          .describe(
            '"content" shows lines, "files_with_matches" shows paths (default), "count" shows counts'
          ),
        context: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe("Lines of context before and after each match"),
        case_insensitive: z
          .boolean()
          .optional()
          .describe("Case insensitive search"),
      }),
      execute: async (
        { pattern, path: searchPath, glob, output_mode, context: contextLines, case_insensitive },
        context
      ) => {
        try {
          const cwd = searchPath
            ? context.resolvePath(searchPath)
            : context.projectPath || context.defaultCwd

          const args = ["--no-heading"]

          if (output_mode === "files_with_matches" || !output_mode) {
            args.push("--files-with-matches")
          } else if (output_mode === "count") {
            args.push("--count")
          } else {
            args.push("--line-number")
          }

          if (case_insensitive) args.push("-i")
          if (typeof contextLines === "number") args.push("-C", `${contextLines}`)
          if (glob) args.push("--glob", glob)

          args.push(pattern)

          const result = await runProcess("rg", args, {
            cwd,
            timeoutMs: 15_000,
          })

          const matches = result.stdout
            .trim()
            .split("\n")
            .filter(Boolean)
            .slice(0, SEARCH_MAX_LINES)

          return {
            matches,
            count: matches.length,
            exitCode: result.exitCode,
          }
        } catch (error) {
          return { error: (error as Error).message }
        }
      },
    }),
    defineTool({
      name: "WebFetch",
      description:
        "Fetch content from a URL and process it. Converts HTML to readable text. Use to read web pages, documentation, API responses, etc.",
      inputSchema: z.object({
        url: z.string().describe("The URL to fetch"),
        prompt: z
          .string()
          .describe("What information to extract from the page"),
      }),
      execute: async ({ url, prompt }) => {
        try {
          const finalUrl = url.startsWith("http://")
            ? url.replace("http://", "https://")
            : url

          const response = await fetch(finalUrl, {
            headers: {
              "User-Agent": "Staged-AI/1.0",
              Accept: "text/html,application/json,text/plain",
            },
            signal: AbortSignal.timeout(15_000),
          })

          if (!response.ok) {
            return { error: `HTTP ${response.status}: ${response.statusText}` }
          }

          let text = await response.text()
          text = text
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/\s+/g, " ")
            .trim()

          if (text.length > 15_000) {
            text = `${text.slice(0, 15_000)}\n...[truncated]`
          }

          return {
            content: text,
            url: finalUrl,
            bytes: text.length,
            prompt,
          }
        } catch (error) {
          return { error: (error as Error).message }
        }
      },
    }),
    defineTool({
      name: "WebSearch",
      description:
        "Search the web for information. Returns search results with titles, URLs, and snippets. Always include Sources at the end of your response when using this.",
      inputSchema: z.object({
        query: z.string().min(2).describe("The search query"),
      }),
      execute: async ({ query }) => {
        try {
          const response = await fetch(
            `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
            {
              headers: { "User-Agent": "Staged-AI/1.0" },
              signal: AbortSignal.timeout(10_000),
            }
          )

          const html = await response.text()
          const results: Array<{ title: string; url: string; snippet: string }> = []

          const resultRegex =
            /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi

          let match: RegExpExecArray | null = null
          while ((match = resultRegex.exec(html)) !== null && results.length < 8) {
            results.push({
              url: match[1]
                .replace(/.*uddg=/, "")
                .replace(/&.*/, "")
                .replace(/%3A/g, ":")
                .replace(/%2F/g, "/"),
              title: match[2].replace(/<[^>]+>/g, "").trim(),
              snippet: match[3].replace(/<[^>]+>/g, "").trim(),
            })
          }

          return { results, count: results.length }
        } catch (error) {
          return { error: (error as Error).message }
        }
      },
    }),
    defineTool({
      name: "NotebookEdit",
      description:
        "Edit a Jupyter notebook cell. Can replace cell contents, insert new cells, or delete cells.",
      inputSchema: z.object({
        notebook_path: z.string().describe("Path to the .ipynb file"),
        cell_number: z
          .number()
          .int()
          .nonnegative()
          .describe("0-indexed cell number to edit/insert at/delete"),
        new_source: z
          .string()
          .optional()
          .describe("New cell content (required for replace/insert)"),
        cell_type: z
          .enum(["code", "markdown"])
          .optional()
          .describe("Cell type for insert (default: code)"),
        edit_mode: z
          .enum(["replace", "insert", "delete"])
          .optional()
          .describe("Edit mode (default: replace)"),
      }),
      execute: async (
        { notebook_path, cell_number, new_source, cell_type, edit_mode },
        context
      ) => {
        try {
          const resolved = context.resolvePath(notebook_path)
          const raw = await fs.readFile(resolved, "utf-8")
          const notebook = JSON.parse(raw) as {
            cells: Array<{
              source: string[]
              cell_type: "code" | "markdown"
              metadata: Record<string, unknown>
              outputs?: unknown[]
              execution_count?: number | null
            }>
          }

          const mode = edit_mode ?? "replace"

          if (mode === "delete") {
            if (cell_number < 0 || cell_number >= notebook.cells.length) {
              return { error: "Cell number out of range" }
            }
            notebook.cells.splice(cell_number, 1)
          } else if (mode === "insert") {
            const nextCellType = cell_type ?? "code"
            const newCell = {
              cell_type: nextCellType,
              source: (new_source ?? "")
                .split("\n")
                .map((line: string, index: number, all: string[]) =>
                  index < all.length - 1 ? `${line}\n` : line
                ),
              metadata: {},
              ...(nextCellType === "markdown"
                ? {}
                : {
                    outputs: [],
                    execution_count: null,
                  }),
            }
            notebook.cells.splice(cell_number, 0, newCell)
          } else {
            if (cell_number < 0 || cell_number >= notebook.cells.length) {
              return { error: "Cell number out of range" }
            }

            notebook.cells[cell_number]!.source = (new_source ?? "")
              .split("\n")
              .map((line: string, index: number, all: string[]) =>
                index < all.length - 1 ? `${line}\n` : line
              )
          }

          await fs.writeFile(resolved, JSON.stringify(notebook, null, 1), "utf-8")
          return { success: true, totalCells: notebook.cells.length }
        } catch (error) {
          return { error: (error as Error).message }
        }
      },
    }),
  ]
}

export async function executeShellCommand(
  command: string,
  cwd: string,
  timeoutMs = 30_000
) {
  return runProcess("/bin/zsh", ["-lc", command], {
    cwd,
    timeoutMs,
  })
}
