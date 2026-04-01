import { z } from "zod"
import { router, publicProcedure } from "../trpc"
import {
  portals,
  portalUpdates,
  portalComments,
  users,
  boards,
  boardColumns,
  tasks,
} from "../../db/schema"
import { eq, asc, desc } from "drizzle-orm"

export const portalRouter = router({
  list: publicProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
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

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
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

  create: publicProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        name: z.string().min(1).max(100),
        clientName: z.string().min(1).max(100),
        clientEmail: z.string().email().optional(),
        description: z.string().optional(),
        boardId: z.string().uuid().optional(),
        createdById: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
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
          createdById: input.createdById,
        })
        .returning()

      return portal
    }),

  addUpdate: publicProcedure
    .input(
      z.object({
        portalId: z.string().uuid(),
        content: z.string().min(1),
        type: z.enum(["update", "deliverable"]).default("update"),
        createdById: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [update] = await ctx.db
        .insert(portalUpdates)
        .values({
          portalId: input.portalId,
          content: input.content,
          type: input.type,
          createdById: input.createdById,
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [update] = await ctx.db
        .update(portalUpdates)
        .set({ status: input.status })
        .where(eq(portalUpdates.id, input.updateId))
        .returning()

      return update
    }),
})
