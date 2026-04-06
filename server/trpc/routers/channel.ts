import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, publicProcedure } from "../trpc"
import {
  channels,
  channelMembers,
  users,
  workspaceMembers,
} from "../../db/schema"
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

  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(80),
        description: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Authentication required",
        })
      }

      const [channel] = await ctx.db
        .select({
          id: channels.id,
          workspaceId: channels.workspaceId,
        })
        .from(channels)
        .where(eq(channels.id, input.id))
        .limit(1)

      if (!channel) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Channel not found" })
      }

      const [membership] = await ctx.db
        .select({ role: workspaceMembers.role })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, channel.workspaceId),
            eq(workspaceMembers.userId, ctx.userId)
          )
        )
        .limit(1)

      if (!membership || membership.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only workspace admins can edit channel details",
        })
      }

      const normalizedName = input.name.trim()
      const slug = normalizedName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")

      const [updated] = await ctx.db
        .update(channels)
        .set({
          name: normalizedName,
          slug: slug || "channel",
          description: input.description?.trim() || null,
        })
        .where(eq(channels.id, input.id))
        .returning()

      return updated ?? null
    }),

  getMembers: publicProcedure
    .input(z.object({ channelId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .selectDistinct({
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
