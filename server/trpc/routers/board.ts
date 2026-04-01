import { z } from "zod"
import { router, publicProcedure } from "../trpc"
import { boards, boardColumns, tasks, users } from "../../db/schema"
import { eq, asc, and, ne } from "drizzle-orm"

export const boardRouter = router({
  list: publicProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(boards)
        .where(eq(boards.workspaceId, input.workspaceId))
        .orderBy(asc(boards.createdAt))
    }),

  getById: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        filterMode: z.enum(["all", "active"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const [board] = await ctx.db
        .select()
        .from(boards)
        .where(eq(boards.id, input.id))

      if (!board) return null

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

  create: publicProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        name: z.string().min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
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
})
