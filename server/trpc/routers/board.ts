import { z } from "zod"
import { router, protectedProcedure } from "../trpc"
import { boards, boardColumns, tasks, users } from "../../db/schema"
import { eq, asc, and, ne, sql } from "drizzle-orm"
import {
  requireWorkspaceMember,
  workspaceIdByBoardId,
} from "@/server/trpc/access"

let boardMigrated = false
async function ensureBoardTaskColumns(db: {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>
}) {
  if (boardMigrated) return
  await db.execute(
    sql`alter table tasks add column if not exists labels text[] not null default '{}'::text[]`
  )
  await db.execute(
    sql`alter table tasks add column if not exists attachments jsonb not null default '[]'::jsonb`
  )
  boardMigrated = true
}

export const boardRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireWorkspaceMember(ctx, input.workspaceId, ctx.userId)
      return ctx.db
        .select()
        .from(boards)
        .where(eq(boards.workspaceId, input.workspaceId))
        .orderBy(asc(boards.createdAt))
    }),

  getById: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        filterMode: z.enum(["all", "active"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await ensureBoardTaskColumns(ctx.db)
      const [board] = await ctx.db
        .select()
        .from(boards)
        .where(eq(boards.id, input.id))

      if (!board) return null
      await requireWorkspaceMember(ctx, board.workspaceId, ctx.userId)

      const columns = await ctx.db
        .select()
        .from(boardColumns)
        .where(eq(boardColumns.boardId, input.id))
        .orderBy(asc(boardColumns.position))

      const doneColumn =
        input.filterMode === "active"
          ? columns.find((c) => c.name === "Done")
          : null

      const allTasks = await ctx.db
        .select({
          id: tasks.id,
          boardId: tasks.boardId,
          columnId: tasks.columnId,
          workspaceId: tasks.workspaceId,
          title: tasks.title,
          description: tasks.description,
          assigneeId: tasks.assigneeId,
          priority: tasks.priority,
          dueDate: tasks.dueDate,
          position: tasks.position,
          createdById: tasks.createdById,
          channelMessageId: tasks.channelMessageId,
          labels: tasks.labels,
          attachments: tasks.attachments,
          createdAt: tasks.createdAt,
          updatedAt: tasks.updatedAt,
          assigneeName: users.name,
          assigneeAvatar: users.avatarUrl,
        })
        .from(tasks)
        .leftJoin(users, eq(tasks.assigneeId, users.id))
        .where(
          doneColumn
            ? and(
                eq(tasks.boardId, input.id),
                ne(tasks.columnId, doneColumn.id)
              )
            : eq(tasks.boardId, input.id)
        )
        .orderBy(asc(tasks.position))

      return {
        ...board,
        columns: columns
          .filter((c) => (doneColumn ? c.id !== doneColumn.id : true))
          .map((col) => ({
            ...col,
            tasks: allTasks.filter((t) => t.columnId === col.id),
          })),
      }
    }),

  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        name: z.string().min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireWorkspaceMember(ctx, input.workspaceId, ctx.userId)
      const [board] = await ctx.db
        .insert(boards)
        .values({
          workspaceId: input.workspaceId,
          name: input.name,
        })
        .returning()

      // Auto-create default columns
      await ctx.db.insert(boardColumns).values([
        { boardId: board.id, name: "To Do", position: 0 },
        { boardId: board.id, name: "In Progress", position: 1 },
        { boardId: board.id, name: "Done", position: 2 },
      ])

      return board
    }),

  rename: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await workspaceIdByBoardId(ctx, input.id)
      await requireWorkspaceMember(ctx, workspaceId, ctx.userId)
      const [board] = await ctx.db
        .update(boards)
        .set({
          name: input.name.trim(),
        })
        .where(eq(boards.id, input.id))
        .returning()

      return board ?? null
    }),

  delete: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await workspaceIdByBoardId(ctx, input.id)
      await requireWorkspaceMember(ctx, workspaceId, ctx.userId)
      const [deleted] = await ctx.db
        .delete(boards)
        .where(eq(boards.id, input.id))
        .returning({ id: boards.id })
      return { ok: Boolean(deleted), id: deleted?.id ?? input.id }
    }),
})
