import { authenticateBridgeSession, pushBridgeEvent } from "@/server/agent/bridge"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : ""
  const token = typeof body?.token === "string" ? body.token.trim() : ""
  const type = typeof body?.type === "string" ? body.type.trim() : ""
  const payload =
    body?.payload && typeof body.payload === "object"
      ? (body.payload as Record<string, unknown>)
      : {}

  if (!sessionId || !token || !type) {
    return Response.json(
      { ok: false, error: "sessionId, token and type are required" },
      { status: 400 }
    )
  }

  if (!authenticateBridgeSession(sessionId, token)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  const pushed = pushBridgeEvent(sessionId, type, payload)
  return Response.json({ ok: pushed, pushed })
}
