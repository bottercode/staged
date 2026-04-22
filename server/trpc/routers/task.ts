/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure } from "../trpc"
import { boardColumns, boards, taskComments, tasks, users } from "../../db/schema"
import { eq, and, gte, sql, asc } from "drizzle-orm"
import {
  requireWorkspaceMember,
  workspaceIdByTaskId,
} from "@/server/trpc/access"

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

let tasksMigrated = false
async function ensureTaskLabelsColumn(db: {
  execute: (query: any) => Promise<unknown>
}) {
  if (tasksMigrated) return
  await db.execute(sql`
    alter table tasks
    add column if not exists labels text[] not null default '{}'::text[]
  `)
  await db.execute(sql`
    alter table tasks
    add column if not exists attachments jsonb not null default '[]'::jsonb
  `)
  tasksMigrated = true
}

export const taskRouter = router({
  create: protectedProcedure
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
        channelMessageId: z.string().uuid().optional(),
        attachments: z
          .array(
            z.object({
              url: z.string(),
              name: z.string(),
              size: z.number(),
              contentType: z.string(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureTaskLabelsColumn(ctx.db)
      await requireWorkspaceMember(ctx, input.workspaceId, ctx.userId)

      const [board] = await ctx.db
        .select({ id: boards.id, workspaceId: boards.workspaceId })
        .from(boards)
        .where(eq(boards.id, input.boardId))
        .limit(1)

      if (!board || board.workspaceId !== input.workspaceId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Board does not belong to this workspace",
        })
      }

      const [column] = await ctx.db
        .select({ id: boardColumns.id, boardId: boardColumns.boardId })
        .from(boardColumns)
        .where(eq(boardColumns.id, input.columnId))
        .limit(1)

      if (!column || column.boardId !== input.boardId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Column does not belong to selected board",
        })
      }

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
          attachments: input.attachments ?? [],
          position: (maxPos?.max ?? -1) + 1,
          createdById: ctx.userId,
          channelMessageId: input.channelMessageId,
        })
        .returning()

      return task
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(500).optional(),
        description: z.string().nullable().optional(),
        assigneeId: z.string().uuid().nullable().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        dueDate: z.string().datetime().nullable().optional(),
        labels: z.array(z.string().min(1).max(40)).optional(),
        attachments: z
          .array(
            z.object({
              url: z.string(),
              name: z.string(),
              size: z.number(),
              contentType: z.string(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureTaskLabelsColumn(ctx.db)
      const workspaceId = await workspaceIdByTaskId(ctx, input.id)
      await requireWorkspaceMember(ctx, workspaceId, ctx.userId)
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
      if (updates.attachments !== undefined)
        values.attachments = updates.attachments

      const [task] = await ctx.db
        .update(tasks)
        .set(values)
        .where(eq(tasks.id, id))
        .returning()

      return task
    }),

  move: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        columnId: z.string().uuid(),
        position: z.number().int().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await workspaceIdByTaskId(ctx, input.id)
      await requireWorkspaceMember(ctx, workspaceId, ctx.userId)
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

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await workspaceIdByTaskId(ctx, input.id)
      await requireWorkspaceMember(ctx, workspaceId, ctx.userId)
      await ctx.db.delete(tasks).where(eq(tasks.id, input.id))
      return { success: true }
    }),

  comments: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await ensureTaskCommentsTable(ctx.db)
      const workspaceId = await workspaceIdByTaskId(ctx, input.taskId)
      await requireWorkspaceMember(ctx, workspaceId, ctx.userId)
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

  addComment: protectedProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        content: z.string().min(1).max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureTaskCommentsTable(ctx.db)
      const workspaceId = await workspaceIdByTaskId(ctx, input.taskId)
      await requireWorkspaceMember(ctx, workspaceId, ctx.userId)

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

  deleteComment: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureTaskCommentsTable(ctx.db)
      const [existing] = await ctx.db
        .select({
          id: taskComments.id,
          userId: taskComments.userId,
          taskId: taskComments.taskId,
        })
        .from(taskComments)
        .where(eq(taskComments.id, input.id))

      if (!existing) return { success: false }
      const workspaceId = await workspaceIdByTaskId(ctx, existing.taskId)
      await requireWorkspaceMember(ctx, workspaceId, ctx.userId)

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
