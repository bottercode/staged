import { NextResponse } from "next/server"
import { desc, eq } from "drizzle-orm"
import { db } from "@/server/db"
import { workspaceMembers } from "@/server/db/schema"
import { getAuthenticatedUserId } from "@/server/auth-user"

export async function GET() {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    return NextResponse.json({ workspaceId: null }, { status: 401 })
  }

  const [membership] = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(desc(workspaceMembers.joinedAt))
    .limit(1)

  return NextResponse.json({
    workspaceId: membership?.workspaceId ?? null,
  })
}

