import { listConversationEvents } from "@/server/agent/history"
import { getAuthenticatedUserId } from "@/server/auth-user"

export async function GET(req: Request) {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const conversationId = searchParams.get("conversationId")?.trim()

  if (!conversationId) {
    return Response.json(
      { ok: false, error: "conversationId is required" },
      { status: 400 }
    )
  }

  try {
    const events = await listConversationEvents(userId, conversationId)
    return Response.json({ ok: true, events })
  } catch {
    return Response.json({ ok: true, events: [] })
  }
}
