import { tool } from "ai"
import { z } from "zod"
import { spawn } from "child_process"
import fs from "fs/promises"
import path from "path"

const MAX_OUTPUT = 20_000
const MAX_LINES = 200

async function runProcess(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      env: { ...process.env, TERM: "xterm-256color" },
    })
    let stdout = ""
    let stderr = ""
    let killed = false

    const timer = setTimeout(() => {
      killed = true
      child.kill("SIGTERM")
    }, timeoutMs)

    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString() })
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString() })
    child.on("error", (err) => { clearTimeout(timer); reject(err) })
    child.on("close", (code) => {
      clearTimeout(timer)
      resolve({
        stdout,
        stderr: killed ? `${stderr}\nProcess timed out after ${timeoutMs}ms`.trim() : stderr,
        exitCode: code ?? 1,
      })
    })
  })
}

function resolvePath(filePath: string, cwd: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath)
}

function truncate(output: string): string {
  if (output.length > MAX_OUTPUT) return output.slice(0, MAX_OUTPUT) + "\n...[truncated]"
  return output
}

export function buildTools(permissionMode: "edit" | "plan", cwd: string) {
  const readOnly = permissionMode === "plan"

  const Read = tool({
    description: "Read a file's contents with line numbers. Always read before editing.",
    inputSchema: z.object({
      file_path: z.string().describe("File path to read"),
      offset: z.number().int().nonnegative().optional().describe("Starting line (0-indexed)"),
      limit: z.number().int().positive().optional().describe("Number of lines to read"),
    }),
    execute: async ({ file_path, offset, limit }) => {
      try {
        const resolved = resolvePath(file_path, cwd)
        const content = await fs.readFile(resolved, "utf-8")
        const lines = content.split("\n")
        const start = offset ?? 0
        const end = Math.min(start + (limit ?? 2000), lines.length)
        return lines.slice(start, end).map((l, i) => `${start + i + 1}\t${l}`).join("\n")
      } catch (err) {
        return `Error: ${(err as Error).message}`
      }
    },
  })

  const Glob = tool({
    description: "Find files matching a glob pattern (e.g. **/*.ts, src/**/*.tsx).",
    inputSchema: z.object({
      pattern: z.string().describe("Glob pattern"),
      path: z.string().optional().describe("Directory to search (default: project root)"),
    }),
    execute: async ({ pattern, path: searchPath }) => {
      const dir = searchPath ? resolvePath(searchPath, cwd) : cwd
      const result = await runProcess(
        "rg",
        ["--files", "--glob", pattern, "--glob", "!**/node_modules/**", "--glob", "!**/.git/**"],
        dir,
        10_000
      ).catch(() => ({ stdout: "", stderr: "", exitCode: 1 }))
      const files = result.stdout.trim().split("\n").filter(Boolean).slice(0, MAX_LINES)
      return files.join("\n") || "(no matches)"
    },
  })

  const Grep = tool({
    description: "Search file contents with regex using ripgrep.",
    inputSchema: z.object({
      pattern: z.string().describe("Regex pattern to search"),
      path: z.string().optional().describe("File or directory (default: project root)"),
      glob: z.string().optional().describe("File filter glob (e.g. *.ts)"),
      output_mode: z.enum(["content", "files_with_matches", "count"]).optional(),
      context: z.number().int().nonnegative().optional().describe("Context lines around matches"),
      case_insensitive: z.boolean().optional(),
    }),
    execute: async ({ pattern, path: searchPath, glob, output_mode, context: ctx, case_insensitive }) => {
      const dir = searchPath ? resolvePath(searchPath, cwd) : cwd
      const args = ["--no-heading"]
      if (!output_mode || output_mode === "files_with_matches") args.push("--files-with-matches")
      else if (output_mode === "count") args.push("--count")
      else args.push("--line-number")
      if (case_insensitive) args.push("-i")
      if (ctx) args.push("-C", String(ctx))
      if (glob) args.push("--glob", glob)
      args.push(pattern)
      const result = await runProcess("rg", args, dir, 15_000)
        .catch(() => ({ stdout: "", stderr: "", exitCode: 1 }))
      const lines = result.stdout.trim().split("\n").filter(Boolean).slice(0, MAX_LINES)
      return lines.join("\n") || "(no matches)"
    },
  })

  const LS = tool({
    description: "List files and directories at a path.",
    inputSchema: z.object({
      path: z.string().optional().describe("Directory path (default: project root)"),
    }),
    execute: async ({ path: dirPath }) => {
      try {
        const dir = dirPath ? resolvePath(dirPath, cwd) : cwd
        const entries = await fs.readdir(dir, { withFileTypes: true })
        return entries.map((e) => `${e.isDirectory() ? "dir" : "file"} ${e.name}`).join("\n") || "(empty)"
      } catch (err) {
        return `Error: ${(err as Error).message}`
      }
    },
  })

  if (readOnly) {
    return { Read, Glob, Grep, LS }
  }

  const Write = tool({
    description: "Create or overwrite a file. Prefer Edit for targeted changes to existing files.",
    inputSchema: z.object({
      file_path: z.string().describe("File path to write"),
      content: z.string().describe("Full file content"),
    }),
    execute: async ({ file_path, content }) => {
      try {
        const resolved = resolvePath(file_path, cwd)
        await fs.mkdir(path.dirname(resolved), { recursive: true })
        await fs.writeFile(resolved, content, "utf-8")
        return `Written ${file_path}`
      } catch (err) {
        return `Error: ${(err as Error).message}`
      }
    },
  })

  const Edit = tool({
    description: "Replace a specific string in a file. old_string must match exactly (including whitespace). Always read the file first.",
    inputSchema: z.object({
      file_path: z.string().describe("File path to edit"),
      old_string: z.string().describe("Exact string to find and replace"),
      new_string: z.string().describe("Replacement string"),
      replace_all: z.boolean().optional().describe("Replace all occurrences (default: false)"),
    }),
    execute: async ({ file_path, old_string, new_string, replace_all }) => {
      try {
        const resolved = resolvePath(file_path, cwd)
        const content = await fs.readFile(resolved, "utf-8")
        if (!content.includes(old_string)) {
          return `Error: old_string not found in ${file_path}. Read the file first to verify the exact content.`
        }
        const updated = replace_all
          ? content.split(old_string).join(new_string)
          : content.replace(old_string, new_string)
        await fs.writeFile(resolved, updated, "utf-8")
        return `Edited ${file_path}`
      } catch (err) {
        return `Error: ${(err as Error).message}`
      }
    },
  })

  const Bash = tool({
    description: "Run a shell command. Use for git, npm/pnpm, builds, tests. Do NOT use for grep/find/cat — use Grep, Glob, Read instead.",
    inputSchema: z.object({
      command: z.string().describe("Shell command to run"),
      timeout: z.number().int().positive().optional().describe("Timeout in ms (max 120000, default 30000)"),
    }),
    execute: async ({ command, timeout }) => {
      const timeoutMs = Math.min(timeout ?? 30_000, 120_000)
      const result = await runProcess("/bin/zsh", ["-lc", command], cwd, timeoutMs)
      const out = (result.stdout + (result.stderr ? `\nSTDERR:\n${result.stderr}` : "")).trim()
      return truncate(out) || "(no output)"
    },
  })

  return { Read, Write, Edit, Bash, Glob, Grep, LS }
}
