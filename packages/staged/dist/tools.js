"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTools = buildTools;
const ai_1 = require("ai");
const zod_1 = require("zod");
const child_process_1 = require("child_process");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const MAX_OUTPUT = 20_000;
const MAX_LINES = 200;
async function runProcess(command, args, cwd, timeoutMs) {
    return new Promise((resolve, reject) => {
        const child = (0, child_process_1.spawn)(command, args, {
            cwd,
            shell: false,
            env: { ...process.env, TERM: "xterm-256color" },
        });
        let stdout = "";
        let stderr = "";
        let killed = false;
        const timer = setTimeout(() => {
            killed = true;
            child.kill("SIGTERM");
        }, timeoutMs);
        child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
        child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
        child.on("error", (err) => { clearTimeout(timer); reject(err); });
        child.on("close", (code) => {
            clearTimeout(timer);
            resolve({
                stdout,
                stderr: killed ? `${stderr}\nProcess timed out after ${timeoutMs}ms`.trim() : stderr,
                exitCode: code ?? 1,
            });
        });
    });
}
function resolvePath(filePath, cwd) {
    return path_1.default.isAbsolute(filePath) ? filePath : path_1.default.join(cwd, filePath);
}
function truncate(output) {
    if (output.length > MAX_OUTPUT)
        return output.slice(0, MAX_OUTPUT) + "\n...[truncated]";
    return output;
}
function buildTools(permissionMode, cwd) {
    const readOnly = permissionMode === "plan";
    const Read = (0, ai_1.tool)({
        description: "Read a file's contents with line numbers. Always read before editing.",
        parameters: zod_1.z.object({
            file_path: zod_1.z.string().describe("File path to read"),
            offset: zod_1.z.number().int().nonnegative().optional().describe("Starting line (0-indexed)"),
            limit: zod_1.z.number().int().positive().optional().describe("Number of lines to read"),
        }),
        execute: async ({ file_path, offset, limit }) => {
            try {
                const resolved = resolvePath(file_path, cwd);
                const content = await promises_1.default.readFile(resolved, "utf-8");
                const lines = content.split("\n");
                const start = offset ?? 0;
                const end = Math.min(start + (limit ?? 2000), lines.length);
                return lines.slice(start, end).map((l, i) => `${start + i + 1}\t${l}`).join("\n");
            }
            catch (err) {
                return `Error: ${err.message}`;
            }
        },
    });
    const Glob = (0, ai_1.tool)({
        description: "Find files matching a glob pattern (e.g. **/*.ts, src/**/*.tsx).",
        parameters: zod_1.z.object({
            pattern: zod_1.z.string().describe("Glob pattern"),
            path: zod_1.z.string().optional().describe("Directory to search (default: project root)"),
        }),
        execute: async ({ pattern, path: searchPath }) => {
            const dir = searchPath ? resolvePath(searchPath, cwd) : cwd;
            const result = await runProcess("rg", ["--files", "--glob", pattern, "--glob", "!**/node_modules/**", "--glob", "!**/.git/**"], dir, 10_000).catch(() => ({ stdout: "", stderr: "", exitCode: 1 }));
            const files = result.stdout.trim().split("\n").filter(Boolean).slice(0, MAX_LINES);
            return files.join("\n") || "(no matches)";
        },
    });
    const Grep = (0, ai_1.tool)({
        description: "Search file contents with regex using ripgrep.",
        parameters: zod_1.z.object({
            pattern: zod_1.z.string().describe("Regex pattern to search"),
            path: zod_1.z.string().optional().describe("File or directory (default: project root)"),
            glob: zod_1.z.string().optional().describe("File filter glob (e.g. *.ts)"),
            output_mode: zod_1.z.enum(["content", "files_with_matches", "count"]).optional(),
            context: zod_1.z.number().int().nonnegative().optional().describe("Context lines around matches"),
            case_insensitive: zod_1.z.boolean().optional(),
        }),
        execute: async ({ pattern, path: searchPath, glob, output_mode, context: ctx, case_insensitive }) => {
            const dir = searchPath ? resolvePath(searchPath, cwd) : cwd;
            const args = ["--no-heading"];
            if (!output_mode || output_mode === "files_with_matches")
                args.push("--files-with-matches");
            else if (output_mode === "count")
                args.push("--count");
            else
                args.push("--line-number");
            if (case_insensitive)
                args.push("-i");
            if (ctx)
                args.push("-C", String(ctx));
            if (glob)
                args.push("--glob", glob);
            args.push(pattern);
            const result = await runProcess("rg", args, dir, 15_000)
                .catch(() => ({ stdout: "", stderr: "", exitCode: 1 }));
            const lines = result.stdout.trim().split("\n").filter(Boolean).slice(0, MAX_LINES);
            return lines.join("\n") || "(no matches)";
        },
    });
    const LS = (0, ai_1.tool)({
        description: "List files and directories at a path.",
        parameters: zod_1.z.object({
            path: zod_1.z.string().optional().describe("Directory path (default: project root)"),
        }),
        execute: async ({ path: dirPath }) => {
            try {
                const dir = dirPath ? resolvePath(dirPath, cwd) : cwd;
                const entries = await promises_1.default.readdir(dir, { withFileTypes: true });
                return entries.map((e) => `${e.isDirectory() ? "dir" : "file"} ${e.name}`).join("\n") || "(empty)";
            }
            catch (err) {
                return `Error: ${err.message}`;
            }
        },
    });
    if (readOnly) {
        return { Read, Glob, Grep, LS };
    }
    const Write = (0, ai_1.tool)({
        description: "Create or overwrite a file. Prefer Edit for targeted changes to existing files.",
        parameters: zod_1.z.object({
            file_path: zod_1.z.string().describe("File path to write"),
            content: zod_1.z.string().describe("Full file content"),
        }),
        execute: async ({ file_path, content }) => {
            try {
                const resolved = resolvePath(file_path, cwd);
                await promises_1.default.mkdir(path_1.default.dirname(resolved), { recursive: true });
                await promises_1.default.writeFile(resolved, content, "utf-8");
                return `Written ${file_path}`;
            }
            catch (err) {
                return `Error: ${err.message}`;
            }
        },
    });
    const Edit = (0, ai_1.tool)({
        description: "Replace a specific string in a file. old_string must match exactly (including whitespace). Always read the file first.",
        parameters: zod_1.z.object({
            file_path: zod_1.z.string().describe("File path to edit"),
            old_string: zod_1.z.string().describe("Exact string to find and replace"),
            new_string: zod_1.z.string().describe("Replacement string"),
            replace_all: zod_1.z.boolean().optional().describe("Replace all occurrences (default: false)"),
        }),
        execute: async ({ file_path, old_string, new_string, replace_all }) => {
            try {
                const resolved = resolvePath(file_path, cwd);
                const content = await promises_1.default.readFile(resolved, "utf-8");
                if (!content.includes(old_string)) {
                    return `Error: old_string not found in ${file_path}. Read the file first to verify the exact content.`;
                }
                const updated = replace_all
                    ? content.split(old_string).join(new_string)
                    : content.replace(old_string, new_string);
                await promises_1.default.writeFile(resolved, updated, "utf-8");
                return `Edited ${file_path}`;
            }
            catch (err) {
                return `Error: ${err.message}`;
            }
        },
    });
    const Bash = (0, ai_1.tool)({
        description: "Run a shell command. Use for git, npm/pnpm, builds, tests. Do NOT use for grep/find/cat — use Grep, Glob, Read instead.",
        parameters: zod_1.z.object({
            command: zod_1.z.string().describe("Shell command to run"),
            timeout: zod_1.z.number().int().positive().optional().describe("Timeout in ms (max 120000, default 30000)"),
        }),
        execute: async ({ command, timeout }) => {
            const timeoutMs = Math.min(timeout ?? 30_000, 120_000);
            const result = await runProcess("/bin/zsh", ["-lc", command], cwd, timeoutMs);
            const out = (result.stdout + (result.stderr ? `\nSTDERR:\n${result.stderr}` : "")).trim();
            return truncate(out) || "(no output)";
        },
    });
    return { Read, Write, Edit, Bash, Glob, Grep, LS };
}
