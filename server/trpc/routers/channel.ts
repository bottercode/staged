import { z } from "zod"
import { router, publicProcedure } from "../trpc"
import { channels, channelMembers, users } from "../../db/schema"
import { eq, and, count } from "drizzle-orm"

export const channelRouter = router({
  list: publicProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(channels)
        .where(eq(channels.workspaceId, input.workspaceId))
        .orderBy(channels.name)
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [channel] = await ctx.db
        .select()
        .from(channels)
        .where(eq(channels.id, input.id))

      if (!channel) return null

      const [memberCount] = await ctx.db
        .select({ count: count() })
        .from(channelMembers)
        .where(eq(channelMembers.channelId, input.id))

      return { ...channel, memberCount: memberCount.count }
    }),

  create: publicProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        name: z.string().min(1).max(80),
        description: z.string().optional(),
        isPrivate: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const slug = input.name.toLowerCase().replace(/\s+/g, "-")

      const [channel] = await ctx.db
        .insert(channels)
        .values({
          workspaceId: input.workspaceId,
          name: input.name,
          slug,
          description: input.description,
          isPrivate: input.isPrivate,
        })
        .returning()

      return channel
    }),

  getMembers: publicProcedure
    .input(z.object({ channelId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
        })
        .from(channelMembers)
        .innerJoin(users, eq(channelMembers.userId, users.id))
        .where(eq(channelMembers.channelId, input.channelId))
    }),
})
