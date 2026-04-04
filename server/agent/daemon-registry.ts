import { randomUUID } from "crypto"
import type WebSocket from "ws"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type JobResolver = (event: DaemonEvent) => void

type DaemonConnection = {
  userId: string
  ws: WebSocket
  connectedAt: number
  // Per-job listeners: jobId → callback called for each event
  jobListeners: Map<string, JobResolver>
}

export type DaemonEvent = Record<string, unknown>

// ---------------------------------------------------------------------------
// Token store: token → userId (in-memory, best-effort)
// ---------------------------------------------------------------------------

const tokens = new Map<string, { userId: string; createdAt: number }>()
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export function createDaemonToken(userId: string): string {
  // One active token per user — revoke old ones
  for (const [token, entry] of tokens) {
    if (entry.userId === userId) {
      tokens.delete(token)
    }
  }
  const token = randomUUID()
  tokens.set(token, { userId, createdAt: Date.now() })
  return token
}

export function resolveDaemonToken(token: string): string | null {
  const entry = tokens.get(token)
  if (!entry) return null
  if (Date.now() - entry.createdAt > TOKEN_TTL_MS) {
    tokens.delete(token)
    return null
  }
  return entry.userId
}

// ---------------------------------------------------------------------------
// Daemon connection registry: userId → DaemonConnection
// ---------------------------------------------------------------------------

const connections = new Map<string, DaemonConnection>()

export function registerDaemon(userId: string, ws: WebSocket): void {
  // Close any previous connection for this user
  const prev = connections.get(userId)
  if (prev && prev.ws !== ws) {
    try { prev.ws.close() } catch { /* ignore */ }
  }
  connections.set(userId, {
    userId,
    ws,
    connectedAt: Date.now(),
    jobListeners: new Map(),
  })
}

export function unregisterDaemon(userId: string, ws: WebSocket): void {
  const conn = connections.get(userId)
  if (conn && conn.ws === ws) {
    connections.delete(userId)
  }
}

export function isDaemonConnected(userId: string): boolean {
  const conn = connections.get(userId)
  if (!conn) return false
  const { readyState } = conn.ws as WebSocket & { readyState: number }
  return readyState === 1 // OPEN
}

// ---------------------------------------------------------------------------
// Job dispatch
// ---------------------------------------------------------------------------

export type DaemonJob = {
  prompt: string
  modelId: string
  sessionId: string
  permissionMode: "edit" | "plan"
  cwd: string
  providerApiKeys: {
    anthropicApiKey?: string
    openaiApiKey?: string
    googleApiKey?: string
    mistralApiKey?: string
    xaiApiKey?: string
  }
}

/**
 * Dispatch a job to the daemon and return an async generator of stream-json
 * events. Resolves (generator ends) when the daemon sends { type: "result" }
 * or the connection closes.
 */
export async function* dispatchDaemonJob(
  userId: string,
  job: DaemonJob
): AsyncGenerator<DaemonEvent> {
  const conn = connections.get(userId)
  if (!conn) throw new Error("No daemon connected for this user")

  const jobId = randomUUID()
  const queue: DaemonEvent[] = []
  let resolve: (() => void) | null = null
  let done = false

  const listener: JobResolver = (event) => {
    queue.push(event)
    resolve?.()
    resolve = null
  }

  conn.jobListeners.set(jobId, listener)

  // Send job to daemon
  conn.ws.send(
    JSON.stringify({
      type: "job",
      jobId,
      ...job,
    })
  )

  try {
    while (!done) {
      // Drain the queue
      while (queue.length > 0) {
        const event = queue.shift()!
        yield event
        if (
          event.type === "result" ||
          (event.type === "done" && (event as { jobId?: string }).jobId === jobId)
        ) {
          done = true
          break
        }
      }
      if (done) break

      // Wait for next event
      await new Promise<void>((r) => {
        resolve = r
        // If something arrived while we were setting up, resolve immediately
        if (queue.length > 0) { r(); resolve = null }
      })
    }
  } finally {
    conn.jobListeners.delete(jobId)
  }
}

/**
 * Called by the daemon WebSocket handler when an event arrives from the daemon.
 */
export function receiveDaemonEvent(
  userId: string,
  jobId: string,
  event: DaemonEvent
): void {
  const conn = connections.get(userId)
  if (!conn) return
  const listener = conn.jobListeners.get(jobId)
  listener?.(event)
}
