import { app, ipcMain, BrowserWindow, dialog, shell } from "electron";
import path, { join } from "path";
import fs from "fs/promises";
import { tool, streamText, stepCountIs } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import { createXai } from "@ai-sdk/xai";
import { z } from "zod";
import { spawn } from "child_process";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
function getModel(modelId, keys) {
  const [provider, ...rest] = modelId.split(":");
  const model = rest.join(":");
  switch (provider) {
    case "anthropic": {
      const apiKey = keys.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
      return createAnthropic({ apiKey })(
        model || "claude-sonnet-4-5-20251001"
      );
    }
    case "openai": {
      const apiKey = keys.openaiApiKey || process.env.OPENAI_API_KEY;
      return createOpenAI({ apiKey })(model || "gpt-4o");
    }
    case "google": {
      const apiKey = keys.googleApiKey || process.env.GOOGLE_API_KEY;
      return createGoogleGenerativeAI({ apiKey })(
        model || "gemini-2.0-flash-001"
      );
    }
    case "mistral": {
      const apiKey = keys.mistralApiKey || process.env.MISTRAL_API_KEY;
      return createMistral({ apiKey })(model || "mistral-large-latest");
    }
    case "xai": {
      const apiKey = keys.xaiApiKey || process.env.XAI_API_KEY;
      return createXai({ apiKey })(model || "grok-3-mini-fast-beta");
    }
    default:
      throw new Error(`Unknown model provider: ${provider}`);
  }
}
const MODEL_OPTIONS = [
  { id: "anthropic:claude-sonnet-4-5-20251001", label: "Claude Sonnet 4.5" },
  { id: "anthropic:claude-opus-4-5", label: "Claude Opus 4.5" },
  { id: "openai:gpt-4o", label: "GPT-4o" },
  { id: "openai:o4-mini", label: "o4-mini" },
  { id: "google:gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
  { id: "xai:grok-3-mini-fast-beta", label: "Grok 3 Mini" }
];
const MAX_OUTPUT = 2e4;
const MAX_LINES = 200;
async function runProcess(command, args, cwd, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      env: { ...process.env, TERM: "xterm-256color" }
    });
    let stdout = "";
    let stderr = "";
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGTERM");
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr: killed ? `${stderr}
Process timed out after ${timeoutMs}ms`.trim() : stderr,
        exitCode: code ?? 1
      });
    });
  });
}
function resolvePath(filePath, cwd) {
  return path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
}
function truncate(output) {
  if (output.length > MAX_OUTPUT) return output.slice(0, MAX_OUTPUT) + "\n...[truncated]";
  return output;
}
function buildTools(permissionMode, cwd) {
  const readOnly = permissionMode === "plan";
  const Read = tool({
    description: "Read a file's contents with line numbers. Always read before editing.",
    inputSchema: z.object({
      file_path: z.string().describe("File path to read"),
      offset: z.number().int().nonnegative().optional().describe("Starting line (0-indexed)"),
      limit: z.number().int().positive().optional().describe("Number of lines to read")
    }),
    execute: async ({ file_path, offset, limit }) => {
      try {
        const resolved = resolvePath(file_path, cwd);
        const content = await fs.readFile(resolved, "utf-8");
        const lines = content.split("\n");
        const start = offset ?? 0;
        const end = Math.min(start + (limit ?? 2e3), lines.length);
        return lines.slice(start, end).map((l, i) => `${start + i + 1}	${l}`).join("\n");
      } catch (err) {
        return `Error: ${err.message}`;
      }
    }
  });
  const Glob = tool({
    description: "Find files matching a glob pattern (e.g. **/*.ts, src/**/*.tsx).",
    inputSchema: z.object({
      pattern: z.string().describe("Glob pattern"),
      path: z.string().optional().describe("Directory to search (default: project root)")
    }),
    execute: async ({ pattern, path: searchPath }) => {
      const dir = searchPath ? resolvePath(searchPath, cwd) : cwd;
      const result = await runProcess(
        "rg",
        ["--files", "--glob", pattern, "--glob", "!**/node_modules/**", "--glob", "!**/.git/**"],
        dir,
        1e4
      ).catch(() => ({ stdout: "", stderr: "", exitCode: 1 }));
      const files = result.stdout.trim().split("\n").filter(Boolean).slice(0, MAX_LINES);
      return files.join("\n") || "(no matches)";
    }
  });
  const Grep = tool({
    description: "Search file contents with regex using ripgrep.",
    inputSchema: z.object({
      pattern: z.string().describe("Regex pattern to search"),
      path: z.string().optional().describe("File or directory (default: project root)"),
      glob: z.string().optional().describe("File filter glob (e.g. *.ts)"),
      output_mode: z.enum(["content", "files_with_matches", "count"]).optional(),
      context: z.number().int().nonnegative().optional().describe("Context lines around matches"),
      case_insensitive: z.boolean().optional()
    }),
    execute: async ({ pattern, path: searchPath, glob, output_mode, context: ctx, case_insensitive }) => {
      const dir = searchPath ? resolvePath(searchPath, cwd) : cwd;
      const args = ["--no-heading"];
      if (!output_mode || output_mode === "files_with_matches") args.push("--files-with-matches");
      else if (output_mode === "count") args.push("--count");
      else args.push("--line-number");
      if (case_insensitive) args.push("-i");
      if (ctx) args.push("-C", String(ctx));
      if (glob) args.push("--glob", glob);
      args.push(pattern);
      const result = await runProcess("rg", args, dir, 15e3).catch(() => ({ stdout: "", stderr: "", exitCode: 1 }));
      const lines = result.stdout.trim().split("\n").filter(Boolean).slice(0, MAX_LINES);
      return lines.join("\n") || "(no matches)";
    }
  });
  const LS = tool({
    description: "List files and directories at a path.",
    inputSchema: z.object({
      path: z.string().optional().describe("Directory path (default: project root)")
    }),
    execute: async ({ path: dirPath }) => {
      try {
        const dir = dirPath ? resolvePath(dirPath, cwd) : cwd;
        const entries = await fs.readdir(dir, { withFileTypes: true });
        return entries.map((e) => `${e.isDirectory() ? "dir" : "file"} ${e.name}`).join("\n") || "(empty)";
      } catch (err) {
        return `Error: ${err.message}`;
      }
    }
  });
  if (readOnly) {
    return { Read, Glob, Grep, LS };
  }
  const Write = tool({
    description: "Create or overwrite a file. Prefer Edit for targeted changes to existing files.",
    inputSchema: z.object({
      file_path: z.string().describe("File path to write"),
      content: z.string().describe("Full file content")
    }),
    execute: async ({ file_path, content }) => {
      try {
        const resolved = resolvePath(file_path, cwd);
        await fs.mkdir(path.dirname(resolved), { recursive: true });
        await fs.writeFile(resolved, content, "utf-8");
        return `Written ${file_path}`;
      } catch (err) {
        return `Error: ${err.message}`;
      }
    }
  });
  const Edit = tool({
    description: "Replace a specific string in a file. old_string must match exactly (including whitespace). Always read the file first.",
    inputSchema: z.object({
      file_path: z.string().describe("File path to edit"),
      old_string: z.string().describe("Exact string to find and replace"),
      new_string: z.string().describe("Replacement string"),
      replace_all: z.boolean().optional().describe("Replace all occurrences (default: false)")
    }),
    execute: async ({ file_path, old_string, new_string, replace_all }) => {
      try {
        const resolved = resolvePath(file_path, cwd);
        const content = await fs.readFile(resolved, "utf-8");
        if (!content.includes(old_string)) {
          return `Error: old_string not found in ${file_path}. Read the file first to verify the exact content.`;
        }
        const updated = replace_all ? content.split(old_string).join(new_string) : content.replace(old_string, new_string);
        await fs.writeFile(resolved, updated, "utf-8");
        return `Edited ${file_path}`;
      } catch (err) {
        return `Error: ${err.message}`;
      }
    }
  });
  const Bash = tool({
    description: "Run a shell command. Use for git, npm/pnpm, builds, tests. Do NOT use for grep/find/cat — use Grep, Glob, Read instead.",
    inputSchema: z.object({
      command: z.string().describe("Shell command to run"),
      timeout: z.number().int().positive().optional().describe("Timeout in ms (max 120000, default 30000)")
    }),
    execute: async ({ command, timeout }) => {
      const timeoutMs = Math.min(timeout ?? 3e4, 12e4);
      const result = await runProcess("/bin/zsh", ["-lc", command], cwd, timeoutMs);
      const out = (result.stdout + (result.stderr ? `
STDERR:
${result.stderr}` : "")).trim();
      return truncate(out) || "(no output)";
    }
  });
  return { Read, Write, Edit, Bash, Glob, Grep, LS };
}
function buildSystemPrompt(cwd, isPlanMode) {
  const base = `You are Staged AI — a powerful agentic coding assistant running on the user's local machine via the Staged desktop app.

Tools available: Read, Write, Edit, Bash, Glob, Grep, LS.

Guidelines:
- When asked to do something, DO it — don't just explain.
- Always read a file before editing it. Use Edit for targeted changes, Write only for new files or full rewrites.
- Use Glob and Grep for searching. Do NOT use Bash for grep/find/cat operations.
- Write clean, minimal code that follows existing patterns in the codebase.
- Be direct and concise. Lead with the action, not the reasoning.
- Never claim a file was changed or a command was run unless it actually happened through a tool call.

Working directory: ${cwd}`;
  if (isPlanMode) {
    return base + "\n\nPLAN MODE: Only create plans. Do NOT use Write, Edit, or Bash. Only read files and explain what changes would be made.";
  }
  return base;
}
async function* runAgent(job, signal) {
  const { prompt, modelId, cwd, permissionMode, providerApiKeys, history } = job;
  try {
    const model = getModel(modelId, providerApiKeys);
    const tools = buildTools(permissionMode, cwd);
    const system = buildSystemPrompt(cwd, permissionMode === "plan");
    const messages = [
      ...history,
      { role: "user", content: prompt }
    ];
    let accumulatedText = "";
    const result = streamText({
      model,
      system,
      messages,
      tools,
      stopWhen: stepCountIs(20),
      temperature: 0,
      abortSignal: signal
    });
    for await (const part of result.fullStream) {
      if (signal?.aborted) break;
      const p = part;
      switch (p.type) {
        case "text-delta":
          accumulatedText += p.textDelta ?? "";
          yield { type: "text", text: accumulatedText };
          break;
        case "tool-call":
          yield {
            type: "tool-call",
            id: p.toolCallId,
            name: p.toolName,
            input: p.input
          };
          break;
        case "tool-result":
          yield {
            type: "tool-result",
            id: p.toolCallId,
            name: p.toolName,
            output: typeof p.output === "string" ? p.output : JSON.stringify(p.output)
          };
          break;
        case "start-step":
          accumulatedText = "";
          break;
        case "error":
          yield {
            type: "error",
            message: p.error instanceof Error ? p.error.message : String(p.error)
          };
          return;
      }
    }
    const steps = await result.steps;
    const finalText = steps.map((s) => s.text).filter(Boolean).join("\n") || accumulatedText;
    const newMessages = [];
    for (const step of steps) {
      const s = step;
      const assistantContent = [];
      if (s.text) assistantContent.push({ type: "text", text: s.text });
      for (const tc of s.toolCalls ?? []) {
        assistantContent.push({
          type: "tool-call",
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          input: tc.input
        });
      }
      if (assistantContent.length > 0) {
        newMessages.push({
          role: "assistant",
          content: assistantContent
        });
      }
      const toolResults = s.toolResults ?? [];
      if (toolResults.length > 0) {
        newMessages.push({
          role: "tool",
          content: toolResults.map((tr) => ({
            type: "tool-result",
            toolCallId: tr.toolCallId,
            toolName: tr.toolName,
            output: tr.output
          }))
        });
      }
    }
    job.history.push(
      { role: "user", content: prompt },
      ...newMessages
    );
    yield { type: "done", finalText };
  } catch (err) {
    if (signal?.aborted) {
      yield { type: "done", finalText: "" };
    } else {
      yield {
        type: "error",
        message: err instanceof Error ? err.message : String(err)
      };
    }
  }
}
const SETTINGS_PATH = join(app.getPath("userData"), "settings.json");
const DEFAULT_SETTINGS = {
  modelId: "anthropic:claude-sonnet-4-5-20251001",
  providerApiKeys: {}
};
async function loadSettings() {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf-8");
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
async function saveSettings(settings) {
  await fs.mkdir(join(app.getPath("userData")), { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
}
const activeJobs = /* @__PURE__ */ new Map();
function registerIpcHandlers() {
  ipcMain.handle("dialog:open-folder", async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory"],
      title: "Open Project Folder"
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
  ipcMain.handle("settings:get", async () => loadSettings());
  ipcMain.handle("settings:set", async (_e, settings) => {
    await saveSettings(settings);
    return true;
  });
  ipcMain.handle("models:list", () => MODEL_OPTIONS);
  ipcMain.handle(
    "agent:run",
    async (event, payload) => {
      const settings = await loadSettings();
      const job = {
        jobId: payload.jobId,
        prompt: payload.prompt,
        modelId: settings.modelId,
        cwd: payload.cwd,
        permissionMode: payload.permissionMode,
        providerApiKeys: settings.providerApiKeys,
        history: payload.history
      };
      const abort = new AbortController();
      activeJobs.set(payload.jobId, { job, abort });
      const sender = event.sender;
      (async () => {
        try {
          for await (const agentEvent of runAgent(job, abort.signal)) {
            if (sender.isDestroyed()) break;
            sender.send("agent:event", { jobId: payload.jobId, event: agentEvent });
            if (agentEvent.type === "done" || agentEvent.type === "error") break;
          }
        } finally {
          activeJobs.delete(payload.jobId);
          if (!sender.isDestroyed()) {
            sender.send("agent:event", {
              jobId: payload.jobId,
              event: { type: "done", finalText: "" }
            });
          }
        }
      })();
      return { ok: true };
    }
  );
  ipcMain.handle("agent:stop", (_e, jobId) => {
    const state = activeJobs.get(jobId);
    if (state) {
      state.abort.abort();
      activeJobs.delete(jobId);
    }
    return true;
  });
}
function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 700,
    minHeight: 500,
    backgroundColor: "#0a0a0a",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  });
  win.once("ready-to-show", () => {
    win.show();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  if (process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }
  return win;
}
app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
