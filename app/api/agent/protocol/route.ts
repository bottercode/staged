import { listConversationEvents } from "@/server/agent/history"
import { historyEventToProtocol } from "@/server/agent/protocol"
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
    const history = await listConversationEvents(userId, conversationId)
    const events = history
      .map((event) => historyEventToProtocol(event))
      .filter(Boolean)

    return Response.json({ ok: true, events })
  } catch {
    return Response.json({ ok: true, events: [] })
  }
}
