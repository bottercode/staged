import { stopAgentRun } from "@/server/agent/agent-runner"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const conversationId =
    typeof body?.conversationId === "string" ? body.conversationId.trim() : ""

  if (!conversationId) {
    return Response.json(
      { ok: false, error: "conversationId is required" },
      { status: 400 }
    )
  }

  const stopped = stopAgentRun(conversationId)
  return Response.json({ ok: true, stopped })
}
