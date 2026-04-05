/**
 * staged connect --url <wsUrl> --token <token> [--cwd <path>]
 *
 * Opens a persistent WebSocket connection to the Staged server and runs agent
 * jobs dispatched from the server on the local machine.
 */

import WebSocket from "ws"
import { createServer } from "http"
import { randomUUID } from "crypto"
import fs from "fs/promises"
import path from "path"
import os from "os"
import { streamText, stepCountIs } from "ai"
import type { ModelMessage } from "ai"
import { loadSession, saveSession } from "./session"
import { buildTools } from "./tools"
import { getModel, type ProviderKeys } from "./models"

// ---------------------------------------------------------------------------
// Local browse server — lets the browser navigate the local filesystem
// ---------------------------------------------------------------------------

export const BROWSE_PORT = 39281

function startBrowseServer(): void {
  const server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")

    if (req.method === "OPTIONS") {
      res.writeHead(204)
      res.end()
      return
    }

    const url = new URL(req.url ?? "/", `http://localhost:${BROWSE_PORT}`)
    const dirPath = url.searchParams.get("path") || os.homedir()

    try {
      const resolved = path.resolve(dirPath)
      const entries = await fs.readdir(resolved, { withFileTypes: true })
      const folders = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => e.name)
        .sort()

      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(
        JSON.stringify({
          path: resolved,
          name: path.basename(resolved),
          parent: path.dirname(resolved),
          folders,
        })
      )
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Cannot read directory" }))
    }
  })

  server.listen(BROWSE_PORT, "127.0.0.1", () => {
    process.stdout.write(`Browse server listening on http://localhost:${BROWSE_PORT}\n`)
  })

  server.on("error", () => {
    // Port already in use — another daemon instance is running, that's fine
  })
}

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

type ConnectArgs = {
  wsUrl: string
  token: string
}

function parseConnectArgs(argv: string[]): ConnectArgs | null {
  let wsUrl: string | undefined
  let token: string | undefined

  let i = 0
  while (i < argv.length) {
    const arg = argv[i]
    if (arg === "--url" || arg === "--ws-url") {
      wsUrl = argv[++i]
    } else if (arg === "--token") {
      token = argv[++i]
    }
    i++
  }

  if (!wsUrl || !token) return null

  // Accept both HTTP/HTTPS and WS/WSS URLs — normalise to WSS/WS
  const normalised = wsUrl
    .replace(/^https:\/\//, "wss://")
    .replace(/^http:\/\//, "ws://")

  // Append daemon WS path if missing
  const url = normalised.endsWith("/api/agent/daemon/ws")
    ? normalised
    : normalised.replace(/\/$/, "") + "/api/agent/daemon/ws"

  return { wsUrl: url, token }
}

// ---------------------------------------------------------------------------
// System prompt (same as standalone mode)
// ---------------------------------------------------------------------------

function buildSystemPrompt(cwd: string, isPlanMode: boolean): string {
  const base = `You are Staged AI — a powerful agentic coding assistant running on the user's local machine.

Tools available: Read, Write, Edit, Bash, Glob, Grep, LS.

Guidelines:
- When asked to do something, DO it — don't just explain.
- Always read a file before editing it. Use Edit for targeted changes, Write only for new files or full rewrites.
- Use Glob and Grep for searching. Do NOT use Bash for grep/find/cat operations.
- Write clean, minimal code that follows existing patterns in the codebase.
- Be direct and concise. Lead with the action, not the reasoning.
- Never claim a file was changed or a command was run unless it actually happened through a tool call.

Working directory: ${cwd}`

  if (isPlanMode) {
    return (
      base +
      "\n\nPLAN MODE: Only create plans. Do NOT use Write, Edit, or Bash. Only read files and explain what changes would be made."
    )
  }
  return base
}

// ---------------------------------------------------------------------------
// Run a single agent job
// ---------------------------------------------------------------------------

type JobMessage = {
  type: "job"
  jobId: string
  prompt: string
  modelId: string
  sessionId: string
  permissionMode: "edit" | "plan"
  cwd: string
  providerApiKeys: ProviderKeys
}

async function runJob(job: JobMessage, ws: WebSocket): Promise<void> {
  const { jobId, prompt, modelId, sessionId, permissionMode, cwd, providerApiKeys } = job

  function emit(event: Record<string, unknown>): void {
    if (ws.readyState !== ws.OPEN) return
    ws.send(JSON.stringify({ type: "event", jobId, event }))
  }

  let finalText = ""
  let isError = false

  try {
    const model = getModel(modelId, providerApiKeys)
    const tools = buildTools(permissionMode, cwd)
    const system = buildSystemPrompt(cwd, permissionMode === "plan")

    const session = await loadSession(sessionId)
    session.messages.push({ role: "user", content: prompt } as ModelMessage)

    let accumulatedText = ""

    const result = streamText({
      model,
      system,
      messages: session.messages,
      tools,
      stopWhen: stepCountIs(20),
      temperature: 0,
    })

    for await (const part of result.fullStream) {
      const p = part as Record<string, unknown>

      switch (p.type) {
        case "text-delta":
          accumulatedText += (p.textDelta as string) ?? ""
          emit({
            type: "assistant",
            message: {
              role: "assistant",
              content: [{ type: "text", text: accumulatedText }],
            },
            session_id: sessionId,
          })
          break

        case "tool-call":
          emit({
            type: "assistant",
            message: {
              role: "assistant",
              content: [
                {
                  type: "tool_use",
                  id: p.toolCallId,
                  name: p.toolName,
                  input: p.input,
                },
              ],
            },
            session_id: sessionId,
          })
          break

        case "tool-result":
          emit({
            type: "tool_result",
            message: {
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: p.toolCallId,
                  content:
                    typeof p.output === "string"
                      ? p.output
                      : JSON.stringify(p.output),
                },
              ],
            },
            session_id: sessionId,
          })
          break

        case "start-step":
          accumulatedText = ""
          break

        case "error":
          isError = true
          finalText =
            p.error instanceof Error ? p.error.message : String(p.error)
          break
      }
    }

    // Collect final text and persist session
    const steps = await result.steps
    finalText =
      steps
        .map((s) => s.text)
        .filter(Boolean)
        .join("\n") || finalText

    const newMessages: ModelMessage[] = []
    for (const step of steps) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = step as any
      const assistantContent: unknown[] = []

      if (s.text) assistantContent.push({ type: "text", text: s.text })
      for (const tc of s.toolCalls ?? []) {
        assistantContent.push({
          type: "tool-call",
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          input: tc.input,
        })
      }
      if (assistantContent.length > 0) {
        newMessages.push({ role: "assistant", content: assistantContent } as ModelMessage)
      }

      const toolResults = s.toolResults ?? []
      if (toolResults.length > 0) {
        newMessages.push({
          role: "tool",
          content: toolResults.map((tr: Record<string, unknown>) => ({
            type: "tool-result",
            toolCallId: tr.toolCallId,
            toolName: tr.toolName,
            output: tr.output,
          })),
        } as ModelMessage)
      }
    }
    session.messages.push(...newMessages)
    await saveSession(session)
  } catch (err) {
    isError = true
    finalText = err instanceof Error ? err.message : String(err)
  }

  emit({
    type: "result",
    subtype: isError ? "error" : "success",
    is_error: isError,
    result: finalText,
    session_id: sessionId,
  })

  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ type: "done", jobId }))
  }
}

// ---------------------------------------------------------------------------
// Connect mode entry point
// ---------------------------------------------------------------------------

const RECONNECT_DELAY_MS = 5_000
const MAX_RECONNECT_DELAY_MS = 60_000

export async function runConnectMode(argv: string[]): Promise<void> {
  const args = parseConnectArgs(argv)
  if (!args) {
    process.stderr.write(
      "Usage: staged connect --url <server-url> --token <daemon-token>\n"
    )
    process.exit(1)
  }

  const { wsUrl, token } = args
  const connectUrl = `${wsUrl}?token=${encodeURIComponent(token)}`

  startBrowseServer()

  let delay = RECONNECT_DELAY_MS

  process.stdout.write(`Staged daemon connecting to ${wsUrl}\n`)

  const connect = (): void => {
    const ws = new WebSocket(connectUrl)
    const activeJobs = new Set<string>()

    // Client-side keepalive — keeps Render's proxy from closing idle connections
    let keepaliveTimer: ReturnType<typeof setInterval> | null = null

    ws.on("open", () => {
      delay = RECONNECT_DELAY_MS
      process.stdout.write("Connected. Waiting for jobs...\n")
      keepaliveTimer = setInterval(() => {
        if (ws.readyState === ws.OPEN) {
          try { ws.ping() } catch { /* ignore */ }
        }
      }, 20_000)
    })

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as {
          type?: string
          jobId?: string
        }

        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }))
          return
        }

        if (msg.type === "job" && msg.jobId) {
          const job = msg as JobMessage
          activeJobs.add(job.jobId)
          process.stdout.write(`Running job ${job.jobId} (${job.modelId})\n`)
          runJob(job, ws)
            .catch((err) => {
              process.stderr.write(
                `Job ${job.jobId} error: ${err instanceof Error ? err.message : String(err)}\n`
              )
            })
            .finally(() => {
              activeJobs.delete(job.jobId)
            })
        }
      } catch {
        // ignore malformed frames
      }
    })

    ws.on("close", (code) => {
      if (keepaliveTimer) { clearInterval(keepaliveTimer); keepaliveTimer = null }
      process.stdout.write(`Disconnected (code ${code}). Reconnecting in ${delay / 1000}s...\n`)
      setTimeout(() => {
        delay = Math.min(delay * 2, MAX_RECONNECT_DELAY_MS)
        connect()
      }, delay)
    })

    ws.on("error", (err) => {
      process.stderr.write(`WebSocket error: ${err.message}\n`)
    })
  }

  connect()

  // Keep process alive
  await new Promise<never>(() => { /* run forever */ })
}
