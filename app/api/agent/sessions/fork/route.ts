import { forkSession, touchSession } from "@/server/agent/sessions"
import { getAuthenticatedUserId } from "@/server/auth-user"

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }
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

  await forkSession(userId, sourceConversationId, targetConversationId)
  await touchSession(userId, targetConversationId)
  return Response.json({ ok: true })
}
