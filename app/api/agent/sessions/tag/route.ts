import { tagSession } from "@/server/agent/sessions"
import { getAuthenticatedUserId } from "@/server/auth-user"

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const conversationId =
    typeof body?.conversationId === "string" ? body.conversationId.trim() : ""
  const tag =
    typeof body?.tag === "string" ? body.tag.trim() : body?.tag === null ? null : undefined

  if (!conversationId || tag === undefined) {
    return Response.json(
      { ok: false, error: "conversationId and tag (string|null) are required" },
      { status: 400 }
    )
  }

  await tagSession(userId, conversationId, tag)
  return Response.json({ ok: true })
}
