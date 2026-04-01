import { authenticateBridgeSession, listBridgeEvents } from "@/server/agent/bridge"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get("sessionId")?.trim() || ""
  const token = searchParams.get("token")?.trim() || ""
  const since = Number(searchParams.get("since") || "")
  const afterSeq = Number(searchParams.get("afterSeq") || "")
  const sinceTs = Number.isFinite(since) ? since : undefined
  const cursor = Number.isFinite(afterSeq) ? afterSeq : undefined

  if (!sessionId || !token) {
    return Response.json(
      { ok: false, error: "sessionId and token are required" },
      { status: 400 }
    )
  }

  if (!authenticateBridgeSession(sessionId, token)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  const events = listBridgeEvents(sessionId, {
    sinceTs,
    afterSeq: cursor,
  })
  if (!events) {
    return Response.json({ ok: false, error: "session not found" }, { status: 404 })
  }
  return Response.json({ ok: true, events })
}
