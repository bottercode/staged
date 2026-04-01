import { streamText, tool, stepCountIs } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { openai } from "@ai-sdk/openai"
import { google } from "@ai-sdk/google"
import { mistral } from "@ai-sdk/mistral"
import { xai } from "@ai-sdk/xai"
import { z } from "zod"

// ── Model registry ──────────────────────────────────────
function getModel(modelId: string) {
  // Anthropic
  if (modelId.startsWith("claude-")) return anthropic(modelId)
  // OpenAI
  if (
    modelId.startsWith("gpt-") ||
    modelId.startsWith("o") ||
    modelId.startsWith("chatgpt-")
  )
    return openai(modelId)
  // Google
  if (modelId.startsWith("gemini-")) return google(modelId)
  // Mistral
  if (modelId.startsWith("mistral-") || modelId.startsWith("codestral"))
    return mistral(modelId)
  // xAI
  if (modelId.startsWith("grok-")) return xai(modelId)
  // Default
  return anthropic("claude-sonnet-4-20250514")
}

const SYSTEM_PROMPT = `You are Staged AI — a powerful, agentic coding assistant. You operate like Claude Code.

You have access to these tools:
1. Read — read file contents with line numbers
2. Write — create new files or fully rewrite existing ones
3. Edit — make targeted string replacements in existing files
4. Bash — run shell commands (build, test, lint, git, install, etc.)
5. Glob — fast file pattern matching
6. Grep — ripgrep-powered regex search across files
7. WebFetch — fetch and process web content
8. WebSearch — search the internet for information
9. NotebookEdit — edit Jupyter notebook cells

Guidelines:
- Be helpful, concise, and action-oriented. When asked to do something, DO it — don't just explain.
- Read files before editing them. Use Edit for targeted changes, Write only for new files or full rewrites.
- Use Glob/Grep for searching — do NOT use Bash for grep/find/cat operations.
- Write clean, minimal code. Follow existing patterns in the codebase.
- Run tests after making changes if tests exist.
- Be direct. Lead with the answer or action, not the reasoning.`

export async function POST(req: Request) {
  const { messages, projectPath, modelId } = await req.json()

  // Build dynamic system prompt with project context
  let systemPrompt = SYSTEM_PROMPT
  if (projectPath) {
    try {
      const fs = await import("fs/promises")
      const nodePath = await import("path")
      const entries = await fs.readdir(projectPath, { withFileTypes: true })
      const fileList = entries
        .filter((e) => !e.name.startsWith(".") && e.name !== "node_modules")
        .map((e) => (e.isDirectory() ? e.name + "/" : e.name))
        .slice(0, 100)
      systemPrompt += `\n\nConnected project: ${projectPath} (${nodePath.basename(projectPath)})
Top-level files:\n${fileList.join("\n")}`
    } catch {
      // If we can't read the dir, just use base prompt
    }
  }

  const resolvePath = (p: string) =>
    p.startsWith("/") ? p : `${projectPath}/${p}`

  const result = streamText({
    model: getModel(modelId || "claude-sonnet-4-20250514"),
    system: systemPrompt,
    messages,
    stopWhen: stepCountIs(15),
    tools: {
      // ── Read ────────────────────────────────────────────
      Read: tool({
        description:
          "Read a file from the local filesystem. Returns content with line numbers. Use this to understand existing code before making changes.",
        inputSchema: z.object({
          file_path: z
            .string()
            .describe("Absolute path or path relative to project root"),
          offset: z
            .number()
            .optional()
            .describe("Line number to start reading from (0-indexed)"),
          limit: z
            .number()
            .optional()
            .describe("Number of lines to read. Defaults to 2000."),
        }),
        execute: async ({ file_path, offset, limit }) => {
          try {
            const fs = await import("fs/promises")
            const resolved = resolvePath(file_path)
            const content = await fs.readFile(resolved, "utf-8")
            const lines = content.split("\n")
            const start = offset ?? 0
            const end = Math.min(start + (limit ?? 2000), lines.length)
            const numbered = lines
              .slice(start, end)
              .map((line, i) => `${start + i + 1}\t${line}`)
              .join("\n")
            return {
              content: numbered,
              totalLines: lines.length,
              truncated: end < lines.length,
            }
          } catch (e: any) {
            return { error: e.message }
          }
        },
      }),

      // ── Write ───────────────────────────────────────────
      Write: tool({
        description:
          "Write content to a file. Creates the file if it doesn't exist, overwrites if it does. Use for NEW files or complete rewrites. Prefer Edit for modifying existing files.",
        inputSchema: z.object({
          file_path: z.string().describe("File path to write to"),
          content: z.string().describe("Full file content to write"),
        }),
        execute: async ({ file_path, content }) => {
          try {
            const fs = await import("fs/promises")
            const nodePath = await import("path")
            const resolved = resolvePath(file_path)
            await fs.mkdir(nodePath.dirname(resolved), { recursive: true })
            await fs.writeFile(resolved, content, "utf-8")
            const lines = content.split("\n").length
            return { success: true, path: resolved, linesWritten: lines }
          } catch (e: any) {
            return { error: e.message }
          }
        },
      }),

      // ── Edit ────────────────────────────────────────────
      Edit: tool({
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
        execute: async ({ file_path, old_string, new_string, replace_all }) => {
          try {
            const fs = await import("fs/promises")
            const resolved = resolvePath(file_path)
            const content = await fs.readFile(resolved, "utf-8")
            if (!content.includes(old_string)) {
              return { error: "old_string not found in file" }
            }
            const updated = replace_all
              ? content.replaceAll(old_string, new_string)
              : content.replace(old_string, new_string)
            await fs.writeFile(resolved, updated, "utf-8")
            return { success: true }
          } catch (e: any) {
            return { error: e.message }
          }
        },
      }),

      // ── Bash ────────────────────────────────────────────
      Bash: tool({
        description:
          "Execute a shell command in the project directory. Use for: running tests, building, linting, git operations, installing packages, running scripts. Do NOT use for grep/find/cat — use Grep, Glob, Read instead.",
        inputSchema: z.object({
          command: z.string().describe("The shell command to execute"),
          description: z
            .string()
            .optional()
            .describe("Brief description of what this command does"),
          timeout: z
            .number()
            .optional()
            .describe("Timeout in milliseconds (max 120000, default 30000)"),
        }),
        execute: async ({ command, timeout }) => {
          try {
            const { exec } = await import("child_process")
            const { promisify } = await import("util")
            const execAsync = promisify(exec)
            const timeoutMs = Math.min(timeout ?? 30000, 120000)
            const { stdout, stderr } = await execAsync(command, {
              cwd: projectPath || process.cwd(),
              timeout: timeoutMs,
              maxBuffer: 1024 * 1024 * 5,
            })
            const output = stdout || stderr
            if (output.length > 10000) {
              return {
                output: output.slice(0, 10000),
                truncated: true,
                totalLength: output.length,
              }
            }
            return { output, truncated: false }
          } catch (e: any) {
            return {
              error: e.message,
              stdout: e.stdout?.slice(0, 5000),
              stderr: e.stderr?.slice(0, 5000),
            }
          }
        },
      }),

      // ── Glob ────────────────────────────────────────────
      Glob: tool({
        description:
          "Fast file pattern matching. Find files by name/path pattern. Supports glob patterns like '**/*.ts', 'src/**/*.tsx'. Returns matching file paths.",
        inputSchema: z.object({
          pattern: z.string().describe("Glob pattern to match files against"),
          path: z
            .string()
            .optional()
            .describe("Directory to search in. Defaults to project root."),
        }),
        execute: async ({ pattern, path }) => {
          try {
            const { exec } = await import("child_process")
            const { promisify } = await import("util")
            const execAsync = promisify(exec)
            const cwd = path ? resolvePath(path) : projectPath || process.cwd()
            const { stdout } = await execAsync(
              `find . -path './${pattern}' -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null | head -100 | sort`,
              { cwd, timeout: 10000, maxBuffer: 512 * 1024 }
            )
            const files = stdout.trim().split("\n").filter(Boolean)
            return {
              files,
              count: files.length,
              truncated: files.length >= 100,
            }
          } catch (e: any) {
            return { error: e.message }
          }
        },
      }),

      // ── Grep ────────────────────────────────────────────
      Grep: tool({
        description:
          "Search file contents using ripgrep. Supports regex, file type filtering, context lines, and multiple output modes. Use this instead of Bash grep/rg.",
        inputSchema: z.object({
          pattern: z
            .string()
            .describe("Regex pattern to search for in file contents"),
          path: z
            .string()
            .optional()
            .describe(
              "File or directory to search in. Defaults to project root."
            ),
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
            .optional()
            .describe("Lines of context before and after each match"),
          case_insensitive: z
            .boolean()
            .optional()
            .describe("Case insensitive search"),
        }),
        execute: async ({
          pattern,
          path,
          glob,
          output_mode,
          context,
          case_insensitive,
        }) => {
          try {
            const { exec } = await import("child_process")
            const { promisify } = await import("util")
            const execAsync = promisify(exec)
            const cwd = path ? resolvePath(path) : projectPath || process.cwd()

            let cmd = `rg --no-heading`
            if (output_mode === "files_with_matches" || !output_mode)
              cmd += " --files-with-matches"
            else if (output_mode === "count") cmd += " --count"
            else cmd += " --line-number"

            if (case_insensitive) cmd += " -i"
            if (context) cmd += ` -C ${context}`
            if (glob) cmd += ` --glob "${glob}"`
            cmd += ` "${pattern.replace(/"/g, '\\"')}" || true`

            const { stdout } = await execAsync(cmd, {
              cwd,
              timeout: 15000,
              maxBuffer: 1024 * 1024,
            })
            const lines = stdout
              .trim()
              .split("\n")
              .filter(Boolean)
              .slice(0, 100)
            return { matches: lines, count: lines.length }
          } catch (e: any) {
            return { error: e.message }
          }
        },
      }),

      // ── WebFetch ────────────────────────────────────────
      WebFetch: tool({
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
            const res = await fetch(finalUrl, {
              headers: {
                "User-Agent": "Staged-AI/1.0",
                Accept: "text/html,application/json,text/plain",
              },
              signal: AbortSignal.timeout(15000),
            })
            if (!res.ok) {
              return { error: `HTTP ${res.status}: ${res.statusText}` }
            }
            let text = await res.text()
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
            if (text.length > 15000) {
              text = text.slice(0, 15000) + "\n...[truncated]"
            }
            return { content: text, url: finalUrl, bytes: text.length, prompt }
          } catch (e: any) {
            return { error: e.message }
          }
        },
      }),

      // ── WebSearch ───────────────────────────────────────
      WebSearch: tool({
        description:
          "Search the web for information. Returns search results with titles, URLs, and snippets. Always include Sources at the end of your response when using this.",
        inputSchema: z.object({
          query: z.string().min(2).describe("The search query"),
        }),
        execute: async ({ query }) => {
          try {
            const res = await fetch(
              `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
              {
                headers: { "User-Agent": "Staged-AI/1.0" },
                signal: AbortSignal.timeout(10000),
              }
            )
            const html = await res.text()
            const results: { title: string; url: string; snippet: string }[] =
              []
            const resultRegex =
              /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi
            let match
            while (
              (match = resultRegex.exec(html)) !== null &&
              results.length < 8
            ) {
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
          } catch (e: any) {
            return { error: e.message }
          }
        },
      }),

      // ── NotebookEdit ───────────────────────────────────
      NotebookEdit: tool({
        description:
          "Edit a Jupyter notebook cell. Can replace cell contents, insert new cells, or delete cells.",
        inputSchema: z.object({
          notebook_path: z.string().describe("Path to the .ipynb file"),
          cell_number: z
            .number()
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
        execute: async ({
          notebook_path,
          cell_number,
          new_source,
          cell_type,
          edit_mode,
        }) => {
          try {
            const fs = await import("fs/promises")
            const resolved = resolvePath(notebook_path)
            const raw = await fs.readFile(resolved, "utf-8")
            const nb = JSON.parse(raw)
            const mode = edit_mode ?? "replace"

            if (mode === "delete") {
              if (cell_number < 0 || cell_number >= nb.cells.length)
                return { error: "Cell number out of range" }
              nb.cells.splice(cell_number, 1)
            } else if (mode === "insert") {
              const newCell = {
                cell_type: cell_type ?? "code",
                source: (new_source ?? "")
                  .split("\n")
                  .map((l: string, i: number, a: string[]) =>
                    i < a.length - 1 ? l + "\n" : l
                  ),
                metadata: {},
                ...(cell_type !== "markdown"
                  ? { outputs: [], execution_count: null }
                  : {}),
              }
              nb.cells.splice(cell_number, 0, newCell)
            } else {
              if (cell_number < 0 || cell_number >= nb.cells.length)
                return { error: "Cell number out of range" }
              nb.cells[cell_number].source = (new_source ?? "")
                .split("\n")
                .map((l: string, i: number, a: string[]) =>
                  i < a.length - 1 ? l + "\n" : l
                )
            }
            await fs.writeFile(resolved, JSON.stringify(nb, null, 1), "utf-8")
            return { success: true, totalCells: nb.cells.length }
          } catch (e: any) {
            return { error: e.message }
          }
        },
      }),
    },
  })

  return result.toUIMessageStreamResponse()
}
