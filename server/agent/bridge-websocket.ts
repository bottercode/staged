import type { Server as HttpServer } from "http"
import { WebSocketServer } from "ws"
import {
  authenticateBridgeSession,
  listBridgeEvents,
  subscribeBridgeSession,
} from "@/server/agent/bridge"

const WS_PATH = "/api/agent/bridge/ws"
const HEARTBEAT_MS = 8_000

type BridgeWebSocketServer = {
  path: string
  startedAt: number
}

declare global {
  var __stagedBridgeWsServer: BridgeWebSocketServer | undefined
}

function safeSend(socket: import("ws").WebSocket, value: unknown) {
  if (socket.readyState !== socket.OPEN) return
  socket.send(JSON.stringify(value))
}

function parseCursor(raw: string | null) {
  if (!raw) return 0
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : 0
}

export function ensureBridgeWebSocketServer(server: HttpServer) {
  if (globalThis.__stagedBridgeWsServer) {
    return globalThis.__stagedBridgeWsServer
  }

  const wss = new WebSocketServer({ noServer: true })

  server.on("upgrade", (request, socket, head) => {
    const baseUrl = `http://${request.headers.host || "localhost"}`
    const url = new URL(request.url || "", baseUrl)

    if (url.pathname !== WS_PATH) {
      return
    }

    const sessionId = url.searchParams.get("sessionId")?.trim() || ""
    const token = url.searchParams.get("token")?.trim() || ""
    const cursor = parseCursor(url.searchParams.get("cursor"))

    if (!sessionId || !token || !authenticateBridgeSession(sessionId, token)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n")
      socket.destroy()
      return
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, {
        sessionId,
        cursor,
      })
    })
  })

  wss.on(
    "connection",
    (
      ws,
      context: {
        sessionId: string
        cursor: number
      }
    ) => {
      let cursor = context.cursor

      safeSend(ws, {
        event: "ready",
        data: {
          transport: "websocket",
          sessionId: context.sessionId,
          cursor,
          ts: Date.now(),
        },
      })

      const replay = listBridgeEvents(context.sessionId, { afterSeq: cursor }) || []
      for (const event of replay) {
        cursor = Math.max(cursor, event.seq)
        safeSend(ws, {
          event: "message",
          id: event.seq,
          data: {
            id: event.id,
            type: event.type,
            payload: event.payload,
            ts: event.ts,
            seq: event.seq,
          },
        })
      }

      const unsubscribe = subscribeBridgeSession(context.sessionId, (event) => {
        cursor = Math.max(cursor, event.seq)
        safeSend(ws, {
          event: "message",
          id: event.seq,
          data: {
            id: event.id,
            type: event.type,
            payload: event.payload,
            ts: event.ts,
            seq: event.seq,
          },
        })
      })

      const heartbeat = setInterval(() => {
        safeSend(ws, {
          event: "heartbeat",
          id: cursor,
          data: {
            ts: Date.now(),
            cursor,
          },
        })
      }, HEARTBEAT_MS)

      ws.on("message", (raw) => {
        try {
          const parsed = JSON.parse(String(raw)) as {
            type?: string
            cursor?: number
          }
          if (parsed?.type === "ack" && Number.isFinite(parsed.cursor)) {
            cursor = Math.max(cursor, Number(parsed.cursor))
          }
        } catch {
          // Ignore malformed client frames.
        }
      })

      ws.on("close", () => {
        clearInterval(heartbeat)
        unsubscribe()
      })

      ws.on("error", () => {
        clearInterval(heartbeat)
        unsubscribe()
      })
    }
  )

  globalThis.__stagedBridgeWsServer = {
    path: WS_PATH,
    startedAt: Date.now(),
  }

  return globalThis.__stagedBridgeWsServer
}
