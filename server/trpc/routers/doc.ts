import { z } from "zod"
import { router, protectedProcedure } from "../trpc"
import { docs, users } from "../../db/schema"
import { eq, desc } from "drizzle-orm"
import {
  requireWorkspaceMember,
  workspaceIdByDocId,
} from "@/server/trpc/access"

export const docRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireWorkspaceMember(ctx, input.workspaceId, ctx.userId)
      return ctx.db
        .select({
          id: docs.id,
          parentId: docs.parentId,
          title: docs.title,
          emoji: docs.emoji,
          createdById: docs.createdById,
          createdByName: users.name,
          updatedAt: docs.updatedAt,
        })
        .from(docs)
        .leftJoin(users, eq(docs.createdById, users.id))
        .where(eq(docs.workspaceId, input.workspaceId))
        .orderBy(desc(docs.updatedAt))
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const workspaceId = await workspaceIdByDocId(ctx, input.id)
      await requireWorkspaceMember(ctx, workspaceId, ctx.userId)
      const [doc] = await ctx.db
        .select({
          id: docs.id,
          workspaceId: docs.workspaceId,
          parentId: docs.parentId,
          title: docs.title,
          content: docs.content,
          emoji: docs.emoji,
          createdById: docs.createdById,
          createdByName: users.name,
          createdAt: docs.createdAt,
          updatedAt: docs.updatedAt,
        })
        .from(docs)
        .leftJoin(users, eq(docs.createdById, users.id))
        .where(eq(docs.id, input.id))

      return doc ?? null
    }),

  listChildren: protectedProcedure
    .input(z.object({ parentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const workspaceId = await workspaceIdByDocId(ctx, input.parentId)
      await requireWorkspaceMember(ctx, workspaceId, ctx.userId)
      return ctx.db
        .select({
          id: docs.id,
          parentId: docs.parentId,
          title: docs.title,
          emoji: docs.emoji,
          updatedAt: docs.updatedAt,
        })
        .from(docs)
        .where(eq(docs.parentId, input.parentId))
        .orderBy(desc(docs.updatedAt))
    }),

  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        title: z.string().default("Untitled"),
        parentId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireWorkspaceMember(ctx, input.workspaceId, ctx.userId)
      const [doc] = await ctx.db
        .insert(docs)
        .values({
          workspaceId: input.workspaceId,
          title: input.title,
          createdById: ctx.userId,
          parentId: input.parentId ?? null,
        })
        .returning()

      return doc
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().optional(),
        content: z.string().optional(),
        emoji: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await workspaceIdByDocId(ctx, input.id)
      await requireWorkspaceMember(ctx, workspaceId, ctx.userId)
      const { id, ...updates } = input
      const values: Record<string, unknown> = { updatedAt: new Date() }

      if (updates.title !== undefined) values.title = updates.title
      if (updates.content !== undefined) values.content = updates.content
      if (updates.emoji !== undefined) values.emoji = updates.emoji

      const [doc] = await ctx.db
        .update(docs)
        .set(values)
        .where(eq(docs.id, id))
        .returning()

      return doc
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await workspaceIdByDocId(ctx, input.id)
      await requireWorkspaceMember(ctx, workspaceId, ctx.userId)
      await ctx.db.delete(docs).where(eq(docs.id, input.id))
      return { success: true }
    }),
})
