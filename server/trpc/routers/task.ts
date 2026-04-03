/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, publicProcedure } from "../trpc"
import { taskComments, tasks, users } from "../../db/schema"
import { eq, and, gte, sql, asc } from "drizzle-orm"

async function ensureTaskCommentsTable(db: {
  execute: (query: any) => Promise<unknown>
}) {
  await db.execute(sql`
    create table if not exists task_comments (
      id uuid primary key default gen_random_uuid(),
      task_id uuid not null references tasks(id) on delete cascade,
      user_id uuid not null references users(id) on delete cascade,
      content text not null,
      created_at timestamp not null default now(),
      updated_at timestamp not null default now()
    )
  `)
  await db.execute(sql`
    create index if not exists task_comments_task_id_idx
    on task_comments(task_id, created_at)
  `)
}

async function ensureTaskLabelsColumn(db: {
  execute: (query: any) => Promise<unknown>
}) {
  await db.execute(sql`
    alter table tasks
    add column if not exists labels text[] not null default '{}'::text[]
  `)
}

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
        labels: z.array(z.string().min(1).max(40)).optional(),
        createdById: z.string().uuid(),
        channelMessageId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureTaskLabelsColumn(ctx.db)
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
          labels: input.labels ?? [],
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
        labels: z.array(z.string().min(1).max(40)).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureTaskLabelsColumn(ctx.db)
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
      if (updates.labels !== undefined) values.labels = updates.labels

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

  comments: publicProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await ensureTaskCommentsTable(ctx.db)
      return ctx.db
        .select({
          id: taskComments.id,
          taskId: taskComments.taskId,
          userId: taskComments.userId,
          content: taskComments.content,
          createdAt: taskComments.createdAt,
          updatedAt: taskComments.updatedAt,
          userName: users.name,
          userEmail: users.email,
          userAvatarUrl: users.avatarUrl,
        })
        .from(taskComments)
        .innerJoin(users, eq(taskComments.userId, users.id))
        .where(eq(taskComments.taskId, input.taskId))
        .orderBy(asc(taskComments.createdAt))
    }),

  addComment: publicProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        content: z.string().min(1).max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureTaskCommentsTable(ctx.db)
      if (!ctx.userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Authentication required",
        })
      }

      const [comment] = await ctx.db
        .insert(taskComments)
        .values({
          taskId: input.taskId,
          userId: ctx.userId,
          content: input.content.trim(),
        })
        .returning()

      return comment
    }),

  deleteComment: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureTaskCommentsTable(ctx.db)
      if (!ctx.userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Authentication required",
        })
      }

      const [existing] = await ctx.db
        .select({
          id: taskComments.id,
          userId: taskComments.userId,
        })
        .from(taskComments)
        .where(eq(taskComments.id, input.id))

      if (!existing) return { success: false }

      if (existing.userId !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete your own comments",
        })
      }

      await ctx.db.delete(taskComments).where(eq(taskComments.id, input.id))
      return { success: true }
    }),
})
