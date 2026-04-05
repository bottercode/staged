#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/index.ts
var import_crypto = require("crypto");
var import_ai3 = require("ai");

// src/session.ts
var import_promises = __toESM(require("fs/promises"));
var import_path = __toESM(require("path"));
var import_os = __toESM(require("os"));
var SESSION_DIR = import_path.default.join(import_os.default.homedir(), ".staged-agent", "sessions");
async function loadSession(sessionId) {
  try {
    const filePath = import_path.default.join(SESSION_DIR, `${sessionId}.json`);
    const raw = await import_promises.default.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      sessionId,
      messages: Array.isArray(parsed.messages) ? parsed.messages : []
    };
  } catch {
    return { sessionId, messages: [] };
  }
}
async function saveSession(session) {
  try {
    await import_promises.default.mkdir(SESSION_DIR, { recursive: true });
    const filePath = import_path.default.join(SESSION_DIR, `${session.sessionId}.json`);
    await import_promises.default.writeFile(filePath, JSON.stringify(session, null, 2), "utf-8");
  } catch {
  }
}

// src/tools.ts
var import_ai = require("ai");
var import_zod = require("zod");
var import_child_process = require("child_process");
var import_promises2 = __toESM(require("fs/promises"));
var import_path2 = __toESM(require("path"));
var MAX_OUTPUT = 2e4;
var MAX_LINES = 200;
async function runProcess(command, args, cwd, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = (0, import_child_process.spawn)(command, args, {
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
  return import_path2.default.isAbsolute(filePath) ? filePath : import_path2.default.join(cwd, filePath);
}
function truncate(output) {
  if (output.length > MAX_OUTPUT) return output.slice(0, MAX_OUTPUT) + "\n...[truncated]";
  return output;
}
function buildTools(permissionMode, cwd) {
  const readOnly = permissionMode === "plan";
  const Read = (0, import_ai.tool)({
    description: "Read a file's contents with line numbers. Always read before editing.",
    inputSchema: import_zod.z.object({
      file_path: import_zod.z.string().describe("File path to read"),
      offset: import_zod.z.number().int().nonnegative().optional().describe("Starting line (0-indexed)"),
      limit: import_zod.z.number().int().positive().optional().describe("Number of lines to read")
    }),
    execute: async ({ file_path, offset, limit }) => {
      try {
        const resolved = resolvePath(file_path, cwd);
        const content = await import_promises2.default.readFile(resolved, "utf-8");
        const lines = content.split("\n");
        const start = offset ?? 0;
        const end = Math.min(start + (limit ?? 2e3), lines.length);
        return lines.slice(start, end).map((l, i) => `${start + i + 1}	${l}`).join("\n");
      } catch (err) {
        return `Error: ${err.message}`;
      }
    }
  });
  const Glob = (0, import_ai.tool)({
    description: "Find files matching a glob pattern (e.g. **/*.ts, src/**/*.tsx).",
    inputSchema: import_zod.z.object({
      pattern: import_zod.z.string().describe("Glob pattern"),
      path: import_zod.z.string().optional().describe("Directory to search (default: project root)")
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
  const Grep = (0, import_ai.tool)({
    description: "Search file contents with regex using ripgrep.",
    inputSchema: import_zod.z.object({
      pattern: import_zod.z.string().describe("Regex pattern to search"),
      path: import_zod.z.string().optional().describe("File or directory (default: project root)"),
      glob: import_zod.z.string().optional().describe("File filter glob (e.g. *.ts)"),
      output_mode: import_zod.z.enum(["content", "files_with_matches", "count"]).optional(),
      context: import_zod.z.number().int().nonnegative().optional().describe("Context lines around matches"),
      case_insensitive: import_zod.z.boolean().optional()
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
  const LS = (0, import_ai.tool)({
    description: "List files and directories at a path.",
    inputSchema: import_zod.z.object({
      path: import_zod.z.string().optional().describe("Directory path (default: project root)")
    }),
    execute: async ({ path: dirPath }) => {
      try {
        const dir = dirPath ? resolvePath(dirPath, cwd) : cwd;
        const entries = await import_promises2.default.readdir(dir, { withFileTypes: true });
        return entries.map((e) => `${e.isDirectory() ? "dir" : "file"} ${e.name}`).join("\n") || "(empty)";
      } catch (err) {
        return `Error: ${err.message}`;
      }
    }
  });
  if (readOnly) {
    return { Read, Glob, Grep, LS };
  }
  const Write = (0, import_ai.tool)({
    description: "Create or overwrite a file. Prefer Edit for targeted changes to existing files.",
    inputSchema: import_zod.z.object({
      file_path: import_zod.z.string().describe("File path to write"),
      content: import_zod.z.string().describe("Full file content")
    }),
    execute: async ({ file_path, content }) => {
      try {
        const resolved = resolvePath(file_path, cwd);
        await import_promises2.default.mkdir(import_path2.default.dirname(resolved), { recursive: true });
        await import_promises2.default.writeFile(resolved, content, "utf-8");
        return `Written ${file_path}`;
      } catch (err) {
        return `Error: ${err.message}`;
      }
    }
  });
  const Edit = (0, import_ai.tool)({
    description: "Replace a specific string in a file. old_string must match exactly (including whitespace). Always read the file first.",
    inputSchema: import_zod.z.object({
      file_path: import_zod.z.string().describe("File path to edit"),
      old_string: import_zod.z.string().describe("Exact string to find and replace"),
      new_string: import_zod.z.string().describe("Replacement string"),
      replace_all: import_zod.z.boolean().optional().describe("Replace all occurrences (default: false)")
    }),
    execute: async ({ file_path, old_string, new_string, replace_all }) => {
      try {
        const resolved = resolvePath(file_path, cwd);
        const content = await import_promises2.default.readFile(resolved, "utf-8");
        if (!content.includes(old_string)) {
          return `Error: old_string not found in ${file_path}. Read the file first to verify the exact content.`;
        }
        const updated = replace_all ? content.split(old_string).join(new_string) : content.replace(old_string, new_string);
        await import_promises2.default.writeFile(resolved, updated, "utf-8");
        return `Edited ${file_path}`;
      } catch (err) {
        return `Error: ${err.message}`;
      }
    }
  });
  const Bash = (0, import_ai.tool)({
    description: "Run a shell command. Use for git, npm/pnpm, builds, tests. Do NOT use for grep/find/cat \u2014 use Grep, Glob, Read instead.",
    inputSchema: import_zod.z.object({
      command: import_zod.z.string().describe("Shell command to run"),
      timeout: import_zod.z.number().int().positive().optional().describe("Timeout in ms (max 120000, default 30000)")
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

// src/models.ts
var import_anthropic = require("@ai-sdk/anthropic");
var import_google = require("@ai-sdk/google");
var import_mistral = require("@ai-sdk/mistral");
var import_openai = require("@ai-sdk/openai");
var import_xai = require("@ai-sdk/xai");
var MODEL_ALIASES = {
  sonnet: "claude-sonnet-4-20250514",
  opus: "claude-opus-4-20250514",
  haiku: "claude-haiku-4-20250414"
};
var OPENAI_PREFIXES = ["gpt-", "o1", "o3", "o4", "chatgpt-", "deepseek-", "qwen-", "llama-"];
var GOOGLE_PREFIXES = ["gemini-"];
var MISTRAL_PREFIXES = ["mistral-", "codestral"];
var XAI_PREFIXES = ["grok-"];
function resolveProviderAndModel(modelId) {
  if (modelId.includes(":")) {
    const [provider, ...rest] = modelId.split(":");
    return { provider, model: rest.join(":").trim() };
  }
  const resolved = MODEL_ALIASES[modelId] ?? modelId;
  if (resolved.startsWith("claude-")) return { provider: "anthropic", model: resolved };
  if (OPENAI_PREFIXES.some((p) => resolved.startsWith(p))) return { provider: "openai", model: resolved };
  if (GOOGLE_PREFIXES.some((p) => resolved.startsWith(p))) return { provider: "google", model: resolved };
  if (MISTRAL_PREFIXES.some((p) => resolved.startsWith(p))) return { provider: "mistral", model: resolved };
  if (XAI_PREFIXES.some((p) => resolved.startsWith(p))) return { provider: "xai", model: resolved };
  return { provider: "anthropic", model: resolved };
}
function getModel(modelId, keys) {
  const { provider, model } = resolveProviderAndModel(modelId);
  switch (provider) {
    case "anthropic":
      return (0, import_anthropic.createAnthropic)({ apiKey: keys.anthropicApiKey })(model);
    case "openai":
      return (0, import_openai.createOpenAI)({ apiKey: keys.openaiApiKey })(model);
    case "google":
      return (0, import_google.createGoogleGenerativeAI)({ apiKey: keys.googleApiKey })(model);
    case "mistral":
      return (0, import_mistral.createMistral)({ apiKey: keys.mistralApiKey })(model);
    case "xai":
      return (0, import_xai.createXai)({ apiKey: keys.xaiApiKey })(model);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// src/connect.ts
var import_ws = __toESM(require("ws"));
var import_http = require("http");
var import_promises3 = __toESM(require("fs/promises"));
var import_path3 = __toESM(require("path"));
var import_os2 = __toESM(require("os"));
var import_ai2 = require("ai");
var BROWSE_PORT = 39281;
function startBrowseServer() {
  const server = (0, import_http.createServer)(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    const url = new URL(req.url ?? "/", `http://localhost:${BROWSE_PORT}`);
    const dirPath = url.searchParams.get("path") || import_os2.default.homedir();
    try {
      const resolved = import_path3.default.resolve(dirPath);
      const entries = await import_promises3.default.readdir(resolved, { withFileTypes: true });
      const folders = entries.filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name).sort();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          path: resolved,
          name: import_path3.default.basename(resolved),
          parent: import_path3.default.dirname(resolved),
          folders
        })
      );
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Cannot read directory" }));
    }
  });
  server.listen(BROWSE_PORT, "127.0.0.1", () => {
    process.stdout.write(`Browse server listening on http://localhost:${BROWSE_PORT}
`);
  });
  server.on("error", () => {
  });
}
function parseConnectArgs(argv) {
  let wsUrl;
  let token;
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--url" || arg === "--ws-url") {
      wsUrl = argv[++i];
    } else if (arg === "--token") {
      token = argv[++i];
    }
    i++;
  }
  if (!wsUrl || !token) return null;
  const normalised = wsUrl.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");
  const url = normalised.endsWith("/api/agent/daemon/ws") ? normalised : normalised.replace(/\/$/, "") + "/api/agent/daemon/ws";
  return { wsUrl: url, token };
}
function buildSystemPrompt(cwd, isPlanMode) {
  const base = `You are Staged AI \u2014 a powerful agentic coding assistant running on the user's local machine.

Tools available: Read, Write, Edit, Bash, Glob, Grep, LS.

Guidelines:
- When asked to do something, DO it \u2014 don't just explain.
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
async function runJob(job, ws) {
  const { jobId, prompt, modelId, sessionId, permissionMode, cwd, providerApiKeys } = job;
  function emit2(event) {
    if (ws.readyState !== ws.OPEN) return;
    ws.send(JSON.stringify({ type: "event", jobId, event }));
  }
  let finalText = "";
  let isError = false;
  try {
    const model = getModel(modelId, providerApiKeys);
    const tools = buildTools(permissionMode, cwd);
    const system = buildSystemPrompt(cwd, permissionMode === "plan");
    const session = await loadSession(sessionId);
    session.messages.push({ role: "user", content: prompt });
    let accumulatedText = "";
    const result = (0, import_ai2.streamText)({
      model,
      system,
      messages: session.messages,
      tools,
      stopWhen: (0, import_ai2.stepCountIs)(20),
      temperature: 0
    });
    for await (const part of result.fullStream) {
      const p = part;
      switch (p.type) {
        case "text-delta":
          accumulatedText += p.textDelta ?? "";
          emit2({
            type: "assistant",
            message: {
              role: "assistant",
              content: [{ type: "text", text: accumulatedText }]
            },
            session_id: sessionId
          });
          break;
        case "tool-call":
          emit2({
            type: "assistant",
            message: {
              role: "assistant",
              content: [
                {
                  type: "tool_use",
                  id: p.toolCallId,
                  name: p.toolName,
                  input: p.input
                }
              ]
            },
            session_id: sessionId
          });
          break;
        case "tool-result":
          emit2({
            type: "tool_result",
            message: {
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: p.toolCallId,
                  content: typeof p.output === "string" ? p.output : JSON.stringify(p.output)
                }
              ]
            },
            session_id: sessionId
          });
          break;
        case "start-step":
          accumulatedText = "";
          break;
        case "error":
          isError = true;
          finalText = p.error instanceof Error ? p.error.message : String(p.error);
          break;
      }
    }
    const steps = await result.steps;
    finalText = steps.map((s) => s.text).filter(Boolean).join("\n") || finalText;
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
        newMessages.push({ role: "assistant", content: assistantContent });
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
    session.messages.push(...newMessages);
    await saveSession(session);
  } catch (err) {
    isError = true;
    finalText = err instanceof Error ? err.message : String(err);
  }
  emit2({
    type: "result",
    subtype: isError ? "error" : "success",
    is_error: isError,
    result: finalText,
    session_id: sessionId
  });
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ type: "done", jobId }));
  }
}
var RECONNECT_DELAY_MS = 5e3;
var MAX_RECONNECT_DELAY_MS = 6e4;
async function runConnectMode(argv) {
  const args = parseConnectArgs(argv);
  if (!args) {
    process.stderr.write(
      "Usage: staged connect --url <server-url> --token <daemon-token>\n"
    );
    process.exit(1);
  }
  const { wsUrl, token } = args;
  const connectUrl = `${wsUrl}?token=${encodeURIComponent(token)}`;
  startBrowseServer();
  let delay = RECONNECT_DELAY_MS;
  process.stdout.write(`Staged daemon connecting to ${wsUrl}
`);
  const connect = () => {
    const ws = new import_ws.default(connectUrl);
    const activeJobs = /* @__PURE__ */ new Set();
    ws.on("open", () => {
      delay = RECONNECT_DELAY_MS;
      process.stdout.write("Connected. Waiting for jobs...\n");
    });
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
          return;
        }
        if (msg.type === "job" && msg.jobId) {
          const job = msg;
          activeJobs.add(job.jobId);
          process.stdout.write(`Running job ${job.jobId} (${job.modelId})
`);
          runJob(job, ws).catch((err) => {
            process.stderr.write(
              `Job ${job.jobId} error: ${err instanceof Error ? err.message : String(err)}
`
            );
          }).finally(() => {
            activeJobs.delete(job.jobId);
          });
        }
      } catch {
      }
    });
    ws.on("close", (code) => {
      process.stdout.write(`Disconnected (code ${code}). Reconnecting in ${delay / 1e3}s...
`);
      setTimeout(() => {
        delay = Math.min(delay * 2, MAX_RECONNECT_DELAY_MS);
        connect();
      }, delay);
    });
    ws.on("error", (err) => {
      process.stderr.write(`WebSocket error: ${err.message}
`);
    });
  };
  connect();
  await new Promise(() => {
  });
}

// src/index.ts
function parseArgs(argv) {
  let sessionId;
  let modelId;
  let permissionMode = "edit";
  let prompt;
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    switch (arg) {
      case "--session-id":
        sessionId = argv[++i];
        break;
      case "--model":
        modelId = argv[++i];
        break;
      case "--permission-mode":
        permissionMode = argv[++i] === "plan" ? "plan" : "edit";
        break;
      case "--output-format":
        i++;
        break;
      case "-p":
      case "--verbose":
      case "--include-partial-messages":
        break;
      default:
        if (!arg.startsWith("-")) prompt = arg;
    }
    i++;
  }
  if (!prompt || !modelId) return null;
  return {
    sessionId: sessionId ?? (0, import_crypto.randomUUID)(),
    modelId,
    permissionMode,
    prompt
  };
}
function emit(event) {
  process.stdout.write(JSON.stringify(event) + "\n");
}
function getProviderKeys() {
  return {
    anthropicApiKey: process.env.STAGED_ANTHROPIC_API_KEY,
    openaiApiKey: process.env.STAGED_OPENAI_API_KEY,
    googleApiKey: process.env.STAGED_GOOGLE_API_KEY,
    mistralApiKey: process.env.STAGED_MISTRAL_API_KEY,
    xaiApiKey: process.env.STAGED_XAI_API_KEY
  };
}
function buildSystemPrompt2(cwd, isPlanMode) {
  const base = `You are Staged AI \u2014 a powerful agentic coding assistant running on the user's local machine.

Tools available: Read, Write, Edit, Bash, Glob, Grep, LS.

Guidelines:
- When asked to do something, DO it \u2014 don't just explain.
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
async function main() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs[0] === "connect") {
    await runConnectMode(rawArgs.slice(1));
    return;
  }
  const args = parseArgs(rawArgs);
  if (!args) {
    process.stderr.write("staged: --model and a prompt are required\n");
    process.exit(1);
  }
  const { sessionId, modelId, permissionMode, prompt } = args;
  const cwd = process.cwd();
  const keys = getProviderKeys();
  const session = await loadSession(sessionId);
  session.messages.push({ role: "user", content: prompt });
  emit({ type: "system", subtype: "init", session_id: sessionId });
  let finalText = "";
  let isError = false;
  try {
    const model = getModel(modelId, keys);
    const tools = buildTools(permissionMode, cwd);
    const system = buildSystemPrompt2(cwd, permissionMode === "plan");
    let accumulatedText = "";
    const result = (0, import_ai3.streamText)({
      model,
      system,
      messages: session.messages,
      tools,
      stopWhen: (0, import_ai3.stepCountIs)(20),
      temperature: 0
    });
    for await (const part of result.fullStream) {
      const p = part;
      switch (p.type) {
        case "text-delta":
          accumulatedText += p.textDelta ?? "";
          emit({
            type: "assistant",
            message: {
              role: "assistant",
              content: [{ type: "text", text: accumulatedText }]
            },
            session_id: sessionId
          });
          break;
        case "tool-call":
          emit({
            type: "assistant",
            message: {
              role: "assistant",
              content: [{
                type: "tool_use",
                id: p.toolCallId,
                name: p.toolName,
                input: p.input
              }]
            },
            session_id: sessionId
          });
          break;
        case "tool-result":
          emit({
            type: "tool_result",
            message: {
              role: "user",
              content: [{
                type: "tool_result",
                tool_use_id: p.toolCallId,
                content: typeof p.output === "string" ? p.output : JSON.stringify(p.output)
              }]
            },
            session_id: sessionId
          });
          break;
        case "start-step":
          accumulatedText = "";
          break;
        case "error":
          isError = true;
          finalText = p.error instanceof Error ? p.error.message : String(p.error);
          break;
      }
    }
    const steps = await result.steps;
    finalText = steps.map((s) => s.text).filter(Boolean).join("\n") || finalText;
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
        newMessages.push({ role: "assistant", content: assistantContent });
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
    session.messages.push(...newMessages);
  } catch (err) {
    isError = true;
    finalText = err instanceof Error ? err.message : String(err);
    process.stderr.write(finalText + "\n");
  }
  await saveSession(session);
  emit({
    type: "result",
    subtype: isError ? "error" : "success",
    is_error: isError,
    result: finalText,
    session_id: sessionId
  });
}
main().catch((err) => {
  process.stderr.write(String(err) + "\n");
  process.exit(1);
});
