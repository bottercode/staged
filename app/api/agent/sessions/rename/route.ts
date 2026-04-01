import { renameSession } from "@/server/agent/sessions"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const conversationId =
    typeof body?.conversationId === "string" ? body.conversationId.trim() : ""
  const title = typeof body?.title === "string" ? body.title.trim() : ""

  if (!conversationId || !title) {
    return Response.json(
      { ok: false, error: "conversationId and title are required" },
      { status: 400 }
    )
  }

  await renameSession(conversationId, title)
  return Response.json({ ok: true })
}

