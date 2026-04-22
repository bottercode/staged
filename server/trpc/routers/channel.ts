import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure } from "../trpc"
import {
  channels,
  channelMembers,
  users,
  workspaceMembers,
} from "../../db/schema"
import { eq, and, count, or, inArray } from "drizzle-orm"
import {
  requireChannelAccess,
  requireWorkspaceAdmin,
  requireWorkspaceMember,
  workspaceIdByChannelId,
} from "@/server/trpc/access"

export const channelRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireWorkspaceMember(ctx, input.workspaceId, ctx.userId)

      // Get IDs of private channels the user is a member of
      const memberRows = await ctx.db
        .select({ channelId: channelMembers.channelId })
        .from(channelMembers)
        .where(eq(channelMembers.userId, ctx.userId))

      const memberChannelIds = memberRows
        .map((r) => r.channelId)
        .filter((id): id is string => id !== null)

      return ctx.db
        .select()
        .from(channels)
        .where(
          and(
            eq(channels.workspaceId, input.workspaceId),
            or(
              eq(channels.isPrivate, false),
              memberChannelIds.length > 0
                ? inArray(channels.id, memberChannelIds)
                : undefined
            )
          )
        )
        .orderBy(channels.name)
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireChannelAccess(ctx, input.id, ctx.userId)
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

  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        name: z.string().min(1).max(80),
        description: z.string().optional(),
        isPrivate: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireWorkspaceMember(ctx, input.workspaceId, ctx.userId)
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

      if (input.isPrivate) {
        await ctx.db.insert(channelMembers).values({
          channelId: channel.id,
          userId: ctx.userId,
        })
      }

      return channel
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(80),
        description: z.string().max(200).optional(),
        isPrivate: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await workspaceIdByChannelId(ctx, input.id)
      await requireWorkspaceAdmin(ctx, workspaceId, ctx.userId)

      const [channel] = await ctx.db
        .select({
          id: channels.id,
          slug: channels.slug,
        })
        .from(channels)
        .where(eq(channels.id, input.id))
        .limit(1)

      if (!channel) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Channel not found" })
      }

      const normalizedName = input.name.trim()
      const slug = normalizedName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")

      const isPrivateUpdate =
        input.isPrivate !== undefined && channel.slug !== "general"
          ? { isPrivate: input.isPrivate }
          : {}

      const [updated] = await ctx.db
        .update(channels)
        .set({
          name: normalizedName,
          slug: slug || "channel",
          description: input.description?.trim() || null,
          ...isPrivateUpdate,
        })
        .where(eq(channels.id, input.id))
        .returning()

      return updated ?? null
    }),

  getMembers: protectedProcedure
    .input(z.object({ channelId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireChannelAccess(ctx, input.channelId, ctx.userId)
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

  addMember: protectedProcedure
    .input(
      z.object({
        channelId: z.string().uuid(),
        userId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await workspaceIdByChannelId(ctx, input.channelId)
      await requireWorkspaceAdmin(ctx, workspaceId, ctx.userId)

      const [targetWorkspaceMembership] = await ctx.db
        .select({ id: workspaceMembers.id })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.userId, input.userId)
          )
        )
        .limit(1)

      if (!targetWorkspaceMembership) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User is not in this workspace",
        })
      }

      const [existing] = await ctx.db
        .select({ id: channelMembers.id })
        .from(channelMembers)
        .where(
          and(
            eq(channelMembers.channelId, input.channelId),
            eq(channelMembers.userId, input.userId)
          )
        )
        .limit(1)

      if (!existing) {
        await ctx.db.insert(channelMembers).values({
          channelId: input.channelId,
          userId: input.userId,
        })
      }

      return { ok: true }
    }),

  removeMember: protectedProcedure
    .input(
      z.object({
        channelId: z.string().uuid(),
        userId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [channel] = await ctx.db
        .select({
          id: channels.id,
          slug: channels.slug,
        })
        .from(channels)
        .where(eq(channels.id, input.channelId))
        .limit(1)

      if (!channel) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Channel not found" })
      }
      const workspaceId = await workspaceIdByChannelId(ctx, input.channelId)
      await requireWorkspaceAdmin(ctx, workspaceId, ctx.userId)

      if (channel.slug === "general") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot remove members from #general",
        })
      }

      await ctx.db
        .delete(channelMembers)
        .where(
          and(
            eq(channelMembers.channelId, input.channelId),
            eq(channelMembers.userId, input.userId)
          )
        )

      return { ok: true }
    }),
})
