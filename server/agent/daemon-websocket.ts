import type { Server as HttpServer } from "http"
import { WebSocketServer } from "ws"
import {
  registerDaemon,
  unregisterDaemon,
  resolveDaemonToken,
  receiveDaemonEvent,
} from "@/server/agent/daemon-registry"

const DAEMON_WS_PATH = "/api/agent/daemon/ws"
const HEARTBEAT_MS = 15_000

declare global {
  var __stagedDaemonWsServer: { path: string; startedAt: number } | undefined
}

function safeSend(ws: import("ws").WebSocket, value: unknown) {
  if (ws.readyState !== ws.OPEN) return
  ws.send(JSON.stringify(value))
}

export function ensureDaemonWebSocketServer(server: HttpServer) {
  if (globalThis.__stagedDaemonWsServer) {
    return globalThis.__stagedDaemonWsServer
  }

  const wss = new WebSocketServer({ noServer: true })

  server.on("upgrade", (request, socket, head) => {
    const baseUrl = `http://${request.headers.host || "localhost"}`
    const url = new URL(request.url || "", baseUrl)

    if (url.pathname !== DAEMON_WS_PATH) return

    const token = url.searchParams.get("token")?.trim() || ""
    const userId = resolveDaemonToken(token)

    if (!userId) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n")
      socket.destroy()
      return
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, { userId })
    })
  })

  wss.on(
    "connection",
    (ws, context: { userId: string }) => {
      const { userId } = context

      registerDaemon(userId, ws)

      safeSend(ws, {
        type: "connected",
        userId,
        ts: Date.now(),
      })

      const heartbeat = setInterval(() => {
        safeSend(ws, { type: "ping", ts: Date.now() })
      }, HEARTBEAT_MS)

      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(String(raw)) as {
            type?: string
            jobId?: string
            event?: Record<string, unknown>
          }

          if (msg.type === "pong") return

          if (msg.type === "event" && msg.jobId && msg.event) {
            receiveDaemonEvent(userId, msg.jobId, msg.event)
          }

          // When the daemon sends a terminal result event, also forward it
          if (msg.type === "done" && msg.jobId) {
            receiveDaemonEvent(userId, msg.jobId, { type: "done", jobId: msg.jobId })
          }
        } catch {
          // ignore malformed frames
        }
      })

      ws.on("close", () => {
        clearInterval(heartbeat)
        unregisterDaemon(userId, ws)
      })

      ws.on("error", () => {
        clearInterval(heartbeat)
        unregisterDaemon(userId, ws)
      })
    }
  )

  globalThis.__stagedDaemonWsServer = {
    path: DAEMON_WS_PATH,
    startedAt: Date.now(),
  }

  return globalThis.__stagedDaemonWsServer
}
