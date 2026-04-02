import { eq } from "drizzle-orm"
import { db } from "@/server/db"
import { agentUserState } from "@/server/db/schema"
import { getAuthenticatedUserId } from "@/server/auth-user"

export async function GET() {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const [state] = await db
    .select({ state: agentUserState.state, updatedAt: agentUserState.updatedAt })
    .from(agentUserState)
    .where(eq(agentUserState.userId, userId))
    .limit(1)

  return Response.json({ ok: true, state: state?.state ?? null, updatedAt: state?.updatedAt ?? null })
}

export async function PUT(req: Request) {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const nextState =
    typeof body?.state === "object" && body?.state !== null
      ? (body.state as Record<string, unknown>)
      : null

  if (!nextState) {
    return Response.json({ ok: false, error: "state object is required" }, { status: 400 })
  }

  const now = new Date()
  const [existing] = await db
    .select({ userId: agentUserState.userId })
    .from(agentUserState)
    .where(eq(agentUserState.userId, userId))
    .limit(1)

  if (existing) {
    await db
      .update(agentUserState)
      .set({ state: nextState, updatedAt: now })
      .where(eq(agentUserState.userId, userId))
  } else {
    await db.insert(agentUserState).values({ userId, state: nextState, updatedAt: now })
  }

  return Response.json({ ok: true })
}
