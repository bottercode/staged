import { tagSession } from "@/server/agent/sessions"

export async function POST(req: Request) {
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

  await tagSession(conversationId, tag)
  return Response.json({ ok: true })
}

