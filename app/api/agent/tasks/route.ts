import { NextResponse } from "next/server"
import { and, desc, eq } from "drizzle-orm"
import { db } from "@/server/db"
import {
  boardColumns,
  boards,
  tasks,
  users,
  workspaceMembers,
} from "@/server/db/schema"
import { getAuthenticatedUserId } from "@/server/auth-user"

export async function GET(req: Request) {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const workspaceId = url.searchParams.get("workspaceId")
  if (!workspaceId) {
    return NextResponse.json({ tasks: [] })
  }

  const [membership] = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId)
      )
    )
    .limit(1)

  if (!membership) {
    return NextResponse.json({ tasks: [] })
  }

  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      boardId: tasks.boardId,
      boardName: boards.name,
      columnId: tasks.columnId,
      columnName: boardColumns.name,
      assigneeId: tasks.assigneeId,
      assigneeName: users.name,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .innerJoin(boards, eq(tasks.boardId, boards.id))
    .innerJoin(boardColumns, eq(tasks.columnId, boardColumns.id))
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(eq(tasks.workspaceId, workspaceId))
    .orderBy(desc(tasks.updatedAt))

  return NextResponse.json({ tasks: rows })
}

