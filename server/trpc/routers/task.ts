import { z } from "zod"
import { router, publicProcedure } from "../trpc"
import { tasks } from "../../db/schema"
import { eq, and, gt, gte, sql } from "drizzle-orm"

export const taskRouter = router({
  create: publicProcedure
    .input(
      z.object({
        boardId: z.string().uuid(),
        columnId: z.string().uuid(),
        workspaceId: z.string().uuid(),
        title: z.string().min(1).max(500),
        description: z.string().optional(),
        assigneeId: z.string().uuid().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
        dueDate: z.string().datetime().optional(),
        createdById: z.string().uuid(),
        channelMessageId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get max position in target column
      const [maxPos] = await ctx.db
        .select({ max: sql<number>`coalesce(max(${tasks.position}), -1)` })
        .from(tasks)
        .where(eq(tasks.columnId, input.columnId))

      const [task] = await ctx.db
        .insert(tasks)
        .values({
          boardId: input.boardId,
          columnId: input.columnId,
          workspaceId: input.workspaceId,
          title: input.title,
          description: input.description,
          assigneeId: input.assigneeId,
          priority: input.priority,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
          position: (maxPos?.max ?? -1) + 1,
          createdById: input.createdById,
          channelMessageId: input.channelMessageId,
        })
        .returning()

      return task
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(500).optional(),
        description: z.string().nullable().optional(),
        assigneeId: z.string().uuid().nullable().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        dueDate: z.string().datetime().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input
      const values: Record<string, unknown> = { updatedAt: new Date() }

      if (updates.title !== undefined) values.title = updates.title
      if (updates.description !== undefined)
        values.description = updates.description
      if (updates.assigneeId !== undefined)
        values.assigneeId = updates.assigneeId
      if (updates.priority !== undefined) values.priority = updates.priority
      if (updates.dueDate !== undefined)
        values.dueDate = updates.dueDate ? new Date(updates.dueDate) : null

      const [task] = await ctx.db
        .update(tasks)
        .set(values)
        .where(eq(tasks.id, id))
        .returning()

      return task
    }),

  move: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        columnId: z.string().uuid(),
        position: z.number().int().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Shift tasks in the target column to make room
      await ctx.db
        .update(tasks)
        .set({ position: sql`${tasks.position} + 1` })
        .where(
          and(
            eq(tasks.columnId, input.columnId),
            gte(tasks.position, input.position)
          )
        )

      const [task] = await ctx.db
        .update(tasks)
        .set({
          columnId: input.columnId,
          position: input.position,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, input.id))
        .returning()

      return task
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(tasks).where(eq(tasks.id, input.id))
      return { success: true }
    }),
})
