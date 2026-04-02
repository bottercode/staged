import { listSessions } from "@/server/agent/sessions"
import { getAuthenticatedUserId } from "@/server/auth-user"

export async function GET() {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }
  const sessions = await listSessions(userId)
  return Response.json({ ok: true, sessions })
}
