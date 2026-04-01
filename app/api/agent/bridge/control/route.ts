import {
  authenticateBridgeSession,
  getBridgeSessionState,
  pushBridgeEvent,
  updateBridgeSessionState,
} from "@/server/agent/bridge"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : ""
  const token = typeof body?.token === "string" ? body.token.trim() : ""
  const action = typeof body?.action === "string" ? body.action.trim() : ""
  const payload =
    body?.payload && typeof body.payload === "object"
      ? (body.payload as Record<string, unknown>)
      : {}

  if (!sessionId || !token || !action) {
    return Response.json(
      { ok: false, error: "sessionId, token and action are required" },
      { status: 400 }
    )
  }

  if (!authenticateBridgeSession(sessionId, token)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  if (action === "sync_state") {
    updateBridgeSessionState(sessionId, payload)
    pushBridgeEvent(sessionId, "bridge.state_sync", payload)
    return Response.json({
      ok: true,
      state: getBridgeSessionState(sessionId)?.state || {},
    })
  }

  if (action === "ping") {
    pushBridgeEvent(sessionId, "bridge.ping", {
      ...payload,
      at: new Date().toISOString(),
    })
    return Response.json({ ok: true })
  }

  if (action === "close") {
    pushBridgeEvent(sessionId, "bridge.close", {
      ...payload,
      at: new Date().toISOString(),
    })
    return Response.json({ ok: true, closed: true })
  }

  return Response.json({ ok: false, error: "unsupported action" }, { status: 400 })
}

