import { z } from "zod"
import { router, publicProcedure } from "../trpc"
import { docs, users } from "../../db/schema"
import { eq, desc } from "drizzle-orm"

export const docRouter = router({
  list: publicProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: docs.id,
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

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [doc] = await ctx.db
        .select({
          id: docs.id,
          workspaceId: docs.workspaceId,
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

  create: publicProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        title: z.string().default("Untitled"),
        createdById: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [doc] = await ctx.db
        .insert(docs)
        .values({
          workspaceId: input.workspaceId,
          title: input.title,
          createdById: input.createdById,
        })
        .returning()

      return doc
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().optional(),
        content: z.string().optional(),
        emoji: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
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

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(docs).where(eq(docs.id, input.id))
      return { success: true }
    }),
})
