import { z } from "zod"
import { router, publicProcedure } from "../trpc"
import {
  directMessageRooms,
  directMessageMembers,
  messages,
  users,
  workspaceMembers,
} from "../../db/schema"
import { eq, and, asc, ne } from "drizzle-orm"
import { TRPCError } from "@trpc/server"

export const dmRouter = router({
  list: publicProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        userId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const actorUserId = ctx.userId ?? input.userId
      if (!actorUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Authentication required",
        })
      }

      // Get all DM rooms for this user in this workspace
      const rooms = await ctx.db
        .select({
          roomId: directMessageRooms.id,
          createdAt: directMessageRooms.createdAt,
        })
        .from(directMessageMembers)
        .innerJoin(
          directMessageRooms,
          eq(directMessageMembers.roomId, directMessageRooms.id)
        )
        .where(
          and(
            eq(directMessageMembers.userId, actorUserId),
            eq(directMessageRooms.workspaceId, input.workspaceId)
          )
        )

      // For each room, get the other member(s)
      const result = await Promise.all(
        rooms.map(async (room) => {
          const otherMembers = await ctx.db
            .select({
              id: users.id,
              name: users.name,
              avatarUrl: users.avatarUrl,
            })
            .from(directMessageMembers)
            .innerJoin(users, eq(directMessageMembers.userId, users.id))
            .where(
              and(
                eq(directMessageMembers.roomId, room.roomId),
                ne(directMessageMembers.userId, actorUserId)
              )
            )

          return {
            id: room.roomId,
            members: otherMembers,
          }
        })
      )

      return result
    }),

  create: publicProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        userId: z.string().uuid().optional(),
        otherUserId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const actorUserId = ctx.userId ?? input.userId
      if (!actorUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Authentication required",
        })
      }

      // Ensure both users are in the selected workspace
      const memberships = await ctx.db
        .select({ id: workspaceMembers.id })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, input.workspaceId),
            eq(workspaceMembers.userId, actorUserId)
          )
        )
      const otherMemberships = await ctx.db
        .select({ id: workspaceMembers.id })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, input.workspaceId),
            eq(workspaceMembers.userId, input.otherUserId)
          )
        )

      if (memberships.length === 0 || otherMemberships.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Both users must be members of this workspace",
        })
      }

      // Check if DM room already exists between these users in this workspace
      const existingRooms = await ctx.db
        .select({ roomId: directMessageMembers.roomId })
        .from(directMessageMembers)
        .innerJoin(
          directMessageRooms,
          eq(directMessageMembers.roomId, directMessageRooms.id)
        )
        .where(
          and(
            eq(directMessageMembers.userId, actorUserId),
            eq(directMessageRooms.workspaceId, input.workspaceId)
          )
        )

      for (const room of existingRooms) {
        const otherMember = await ctx.db
          .select()
          .from(directMessageMembers)
          .where(
            and(
              eq(directMessageMembers.roomId, room.roomId),
              eq(directMessageMembers.userId, input.otherUserId)
            )
          )
        if (otherMember.length > 0) {
          return { id: room.roomId, existing: true }
        }
      }

      // Create new DM room
      const [dmRoom] = await ctx.db
        .insert(directMessageRooms)
        .values({ workspaceId: input.workspaceId })
        .returning()

      await ctx.db.insert(directMessageMembers).values([
        { roomId: dmRoom.id, userId: actorUserId },
        { roomId: dmRoom.id, userId: input.otherUserId },
      ])

      return { id: dmRoom.id, existing: false }
    }),

  messages: publicProcedure
    .input(
      z.object({
        roomId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      if (ctx.userId) {
        const [membership] = await ctx.db
          .select({ userId: directMessageMembers.userId })
          .from(directMessageMembers)
          .where(
            and(
              eq(directMessageMembers.roomId, input.roomId),
              eq(directMessageMembers.userId, ctx.userId)
            )
          )
          .limit(1)
        if (!membership) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You are not a member of this DM",
          })
        }
      }

      const rows = await ctx.db
        .select({
          id: messages.id,
          content: messages.content,
          createdAt: messages.createdAt,
          updatedAt: messages.updatedAt,
          parentId: messages.parentId,
          replyCount: messages.replyCount,
          userId: messages.userId,
          userName: users.name,
          userAvatar: users.avatarUrl,
          attachments: messages.attachments,
          isPinned: messages.isPinned,
        })
        .from(messages)
        .innerJoin(users, eq(messages.userId, users.id))
        .where(eq(messages.dmRoomId, input.roomId))
        .orderBy(asc(messages.createdAt))
        .limit(input.limit)
      return rows.map((r) => ({
        ...r,
        replyPreviewUsers: [] as Array<{
          id: string
          name: string
          avatarUrl: string | null
        }>,
        reactions: [] as Array<{
          emoji: string
          count: number
          reactedByMe: boolean
          users: Array<{ id: string; name: string }>
        }>,
      }))
    }),
})
