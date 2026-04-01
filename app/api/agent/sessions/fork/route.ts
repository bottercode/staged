import { forkSession, touchSession } from "@/server/agent/sessions"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const sourceConversationId =
    typeof body?.sourceConversationId === "string"
      ? body.sourceConversationId.trim()
      : ""
  const targetConversationId =
    typeof body?.targetConversationId === "string"
      ? body.targetConversationId.trim()
      : ""

  if (!sourceConversationId || !targetConversationId) {
    return Response.json(
      { ok: false, error: "sourceConversationId and targetConversationId are required" },
      { status: 400 }
    )
  }

  await forkSession(sourceConversationId, targetConversationId)
  await touchSession(targetConversationId)
  return Response.json({ ok: true })
}

