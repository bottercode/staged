import { listSessions } from "@/server/agent/sessions"

export async function GET() {
  const sessions = await listSessions()
  return Response.json({ ok: true, sessions })
}

