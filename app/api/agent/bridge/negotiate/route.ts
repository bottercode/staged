import {
  createBridgeSession,
  getBridgeSession,
  getBridgeSessionState,
} from "@/server/agent/bridge"

export async function POST(req: Request) {
  const { origin } = new URL(req.url)
  const wsOrigin = origin.startsWith("https://")
    ? origin.replace("https://", "wss://")
    : origin.replace("http://", "ws://")
  // Warm the ws bridge endpoint so the server upgrade listener is registered.
  void fetch(`${origin}/api/agent/bridge/ws`, {
    method: "GET",
    cache: "no-store",
  }).catch(() => null)
  const body = await req.json().catch(() => ({}))
  const requestedSessionId =
    typeof body?.sessionId === "string" ? body.sessionId.trim() : ""

  if (requestedSessionId) {
    const existing = getBridgeSession(requestedSessionId)
    if (existing) {
      return Response.json({
        ok: true,
        transport: "websocket",
        fallbackTransport: "sse",
        session: {
          id: existing.id,
          token: existing.token,
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt,
          state: getBridgeSessionState(existing.id)?.state || {},
          cursor: Math.max(existing.nextSeq - 1, 0),
        },
        endpoints: {
          ws: `${wsOrigin}/api/agent/bridge/ws`,
          sse: `${origin}/api/agent/bridge/stream`,
          events: `${origin}/api/agent/bridge/events`,
        },
      })
    }
  }

  const created = createBridgeSession()
  const state = getBridgeSessionState(created.id)
  return Response.json({
    ok: true,
    transport: "websocket",
    fallbackTransport: "sse",
    session: {
      id: created.id,
      token: created.token,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      state: state?.state || {},
      cursor: Math.max((state?.nextSeq || 1) - 1, 0),
    },
    endpoints: {
      ws: `${wsOrigin}/api/agent/bridge/ws`,
      sse: `${origin}/api/agent/bridge/stream`,
      events: `${origin}/api/agent/bridge/events`,
    },
  })
}
