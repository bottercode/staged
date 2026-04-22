/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure, publicProcedure } from "../trpc"
import {
  portals,
  portalUpdates,
  portalComments,
  users,
  boards,
  boardColumns,
  tasks,
} from "../../db/schema"
import { eq, asc, desc, inArray, sql } from "drizzle-orm"
import {
  requireWorkspaceMember,
  workspaceIdByPortalId,
} from "@/server/trpc/access"

async function ensureTaskLabelsColumn(db: {
  execute: (query: any) => Promise<unknown>
}) {
  await db.execute(sql`
    alter table tasks
    add column if not exists labels text[] not null default '{}'::text[]
  `)
}

async function ensurePortalReviewColumns(db: {
  execute: (query: any) => Promise<unknown>
}) {
  await db.execute(sql`
    alter table portal_updates
    add column if not exists reviewed_by_name text
  `)
  await db.execute(sql`
    alter table portal_updates
    add column if not exists reviewed_at timestamp
  `)
}

export const portalRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireWorkspaceMember(ctx, input.workspaceId, ctx.userId)
      return ctx.db
        .select({
          id: portals.id,
          name: portals.name,
          slug: portals.slug,
          clientName: portals.clientName,
          status: portals.status,
          createdAt: portals.createdAt,
        })
        .from(portals)
        .where(eq(portals.workspaceId, input.workspaceId))
        .orderBy(desc(portals.createdAt))
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const workspaceId = await workspaceIdByPortalId(ctx, input.id)
      await requireWorkspaceMember(ctx, workspaceId, ctx.userId)
      await ensurePortalReviewColumns(ctx.db)
      const [portal] = await ctx.db
        .select()
        .from(portals)
        .where(eq(portals.id, input.id))

      if (!portal) return null

      const updatesRaw = await ctx.db
        .select({
          id: portalUpdates.id,
          content: portalUpdates.content,
          type: portalUpdates.type,
          status: portalUpdates.status,
          reviewedByName: portalUpdates.reviewedByName,
          reviewedAt: portalUpdates.reviewedAt,
          createdAt: portalUpdates.createdAt,
          createdById: portalUpdates.createdById,
          authorName: users.name,
          authorAvatar: users.avatarUrl,
        })
        .from(portalUpdates)
        .leftJoin(users, eq(portalUpdates.createdById, users.id))
        .where(eq(portalUpdates.portalId, input.id))
        .orderBy(desc(portalUpdates.createdAt))

      const allComments = await ctx.db
        .select()
        .from(portalComments)
        .orderBy(asc(portalComments.createdAt))

      const updates = updatesRaw.map((u) => ({
        ...u,
        comments: allComments.filter((c) => c.updateId === u.id),
      }))

      return { ...portal, updates }
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensurePortalReviewColumns(ctx.db)
      const [portal] = await ctx.db
        .select()
        .from(portals)
        .where(eq(portals.slug, input.slug))

      if (!portal) return null

      // Get updates with comments
      const updatesRaw = await ctx.db
        .select({
          id: portalUpdates.id,
          content: portalUpdates.content,
          type: portalUpdates.type,
          status: portalUpdates.status,
          reviewedByName: portalUpdates.reviewedByName,
          reviewedAt: portalUpdates.reviewedAt,
          createdAt: portalUpdates.createdAt,
          authorName: users.name,
          authorAvatar: users.avatarUrl,
        })
        .from(portalUpdates)
        .leftJoin(users, eq(portalUpdates.createdById, users.id))
        .where(eq(portalUpdates.portalId, portal.id))
        .orderBy(desc(portalUpdates.createdAt))

      const allComments = await ctx.db
        .select()
        .from(portalComments)
        .orderBy(asc(portalComments.createdAt))

      // Get linked board progress
      let progress = null
      if (portal.boardId) {
        const cols = await ctx.db
          .select()
          .from(boardColumns)
          .where(eq(boardColumns.boardId, portal.boardId))
          .orderBy(asc(boardColumns.position))

        const allTasks = await ctx.db
          .select({
            id: tasks.id,
            columnId: tasks.columnId,
            title: tasks.title,
          })
          .from(tasks)
          .where(eq(tasks.boardId, portal.boardId))

        const totalTasks = allTasks.length
        // Last column is "done"
        const doneCol = cols[cols.length - 1]
        const doneTasks = doneCol
          ? allTasks.filter((t) => t.columnId === doneCol.id).length
          : 0

        progress = {
          total: totalTasks,
          done: doneTasks,
          percentage:
            totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
          columns: cols.map((col) => ({
            name: col.name,
            count: allTasks.filter((t) => t.columnId === col.id).length,
          })),
        }
      }

      const updates = updatesRaw.map((u) => ({
        ...u,
        comments: allComments.filter((c) => c.updateId === u.id),
      }))

      return { ...portal, updates, progress }
    }),

  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        name: z.string().min(1).max(100),
        clientName: z.string().min(1).max(100),
        clientEmail: z.string().email().optional(),
        description: z.string().optional(),
        boardId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireWorkspaceMember(ctx, input.workspaceId, ctx.userId)
      const slug =
        input.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") +
        "-" +
        Math.random().toString(36).slice(2, 8)

      const [portal] = await ctx.db
        .insert(portals)
        .values({
          workspaceId: input.workspaceId,
          name: input.name,
          slug,
          clientName: input.clientName,
          clientEmail: input.clientEmail,
          description: input.description,
          boardId: input.boardId,
          createdById: ctx.userId,
        })
        .returning()

      return portal
    }),

  addUpdate: protectedProcedure
    .input(
      z.object({
        portalId: z.string().uuid(),
        content: z.string().min(1),
        type: z.enum(["update", "deliverable"]).default("update"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await workspaceIdByPortalId(ctx, input.portalId)
      await requireWorkspaceMember(ctx, workspaceId, ctx.userId)
      const [update] = await ctx.db
        .insert(portalUpdates)
        .values({
          portalId: input.portalId,
          content: input.content,
          type: input.type,
          createdById: ctx.userId,
        })
        .returning()

      return update
    }),

  addComment: publicProcedure
    .input(
      z.object({
        updateId: z.string().uuid(),
        content: z.string().min(1),
        authorName: z.string().min(1),
        authorType: z.enum(["client", "member"]).default("client"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [comment] = await ctx.db
        .insert(portalComments)
        .values({
          updateId: input.updateId,
          content: input.content,
          authorName: input.authorName,
          authorType: input.authorType,
        })
        .returning()

      return comment
    }),

  approveDeliverable: publicProcedure
    .input(
      z.object({
        updateId: z.string().uuid(),
        status: z.enum(["approved", "rejected"]),
        reviewerName: z.string().min(1).max(120).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensurePortalReviewColumns(ctx.db)
      const [update] = await ctx.db
        .update(portalUpdates)
        .set({
          status: input.status,
          reviewedByName: input.reviewerName?.trim() || null,
          reviewedAt: new Date(),
        })
        .where(eq(portalUpdates.id, input.updateId))
        .returning()

      return update
    }),

  createIssue: protectedProcedure
    .input(
      z.object({
        portalId: z.string().uuid(),
        boardIds: z.array(z.string().uuid()).min(1),
        title: z.string().min(1).max(500),
        section: z.enum(["todo", "in_progress", "done"]).default("todo"),
        description: z.string().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
        dueDate: z.string().datetime().optional(),
        assigneeId: z.string().uuid().optional(),
        labels: z.array(z.string().min(1).max(40)).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureTaskLabelsColumn(ctx.db)

      const [portal] = await ctx.db
        .select({
          id: portals.id,
          workspaceId: portals.workspaceId,
        })
        .from(portals)
        .where(eq(portals.id, input.portalId))
        .limit(1)

      if (!portal) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Portal not found",
        })
      }
      await requireWorkspaceMember(ctx, portal.workspaceId, ctx.userId)

      const uniqueBoardIds = Array.from(new Set(input.boardIds))
      const selectedBoards = await ctx.db
        .select({
          id: boards.id,
        })
        .from(boards)
        .where(inArray(boards.id, uniqueBoardIds))

      const allowedBoardIds = selectedBoards
        .map((board) => board.id)
        .filter((boardId) => Boolean(boardId))

      if (allowedBoardIds.length !== uniqueBoardIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One or more selected boards were not found",
        })
      }

      const boardWorkspaceMap = new Map<string, boolean>()
      const boardWorkspaceRows = await ctx.db
        .select({
          id: boards.id,
          workspaceId: boards.workspaceId,
        })
        .from(boards)
        .where(inArray(boards.id, allowedBoardIds))
      for (const row of boardWorkspaceRows) {
        boardWorkspaceMap.set(row.id, row.workspaceId === portal.workspaceId)
      }

      if (allowedBoardIds.some((boardId) => !boardWorkspaceMap.get(boardId))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Selected board does not belong to this portal workspace",
        })
      }

      const allColumns = await ctx.db
        .select({
          id: boardColumns.id,
          boardId: boardColumns.boardId,
          name: boardColumns.name,
          position: boardColumns.position,
        })
        .from(boardColumns)
        .where(inArray(boardColumns.boardId, allowedBoardIds))
        .orderBy(asc(boardColumns.position))

      const columnsByBoard = new Map<
        string,
        Array<{ id: string; name: string }>
      >()
      for (const column of allColumns) {
        const list = columnsByBoard.get(column.boardId) ?? []
        list.push({ id: column.id, name: column.name })
        columnsByBoard.set(column.boardId, list)
      }

      const boardsMissingColumn = allowedBoardIds.filter((boardId) => {
        const cols = columnsByBoard.get(boardId) ?? []
        return cols.length === 0
      })
      if (boardsMissingColumn.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selected board has no columns",
        })
      }

      const sectionMatchers: Record<
        "todo" | "in_progress" | "done",
        (name: string) => boolean
      > = {
        todo: (name) => /to\s*do|todo|backlog/i.test(name),
        in_progress: (name) => /in\s*progress|progress|doing/i.test(name),
        done: (name) => /done|completed|complete|closed/i.test(name),
      }

      const created = []
      for (const boardId of allowedBoardIds) {
        const cols = columnsByBoard.get(boardId) ?? []
        const matched =
          cols.find((col) => sectionMatchers[input.section](col.name)) ??
          cols[0]
        const columnId = matched?.id
        if (!columnId) continue

        const [maxPos] = await ctx.db
          .select({ max: sql<number>`coalesce(max(${tasks.position}), -1)` })
          .from(tasks)
          .where(eq(tasks.columnId, columnId))

        const [task] = await ctx.db
          .insert(tasks)
          .values({
            boardId,
            columnId,
            workspaceId: portal.workspaceId,
            title: input.title.trim(),
            description: input.description?.trim() || null,
            assigneeId: input.assigneeId || null,
            priority: input.priority,
            dueDate: input.dueDate ? new Date(input.dueDate) : null,
            labels: input.labels ?? [],
            position: (maxPos?.max ?? -1) + 1,
            createdById: ctx.userId,
          })
          .returning({
            id: tasks.id,
            boardId: tasks.boardId,
            columnId: tasks.columnId,
            title: tasks.title,
          })

        if (task) created.push(task)
      }

      return {
        ok: true,
        createdCount: created.length,
        created,
      }
    }),
})
