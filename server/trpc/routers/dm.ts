import { z } from "zod"
import { router, publicProcedure } from "../trpc"
import {
  directMessageRooms,
  directMessageMembers,
  messages,
  users,
} from "../../db/schema"
import { eq, and, asc, sql, ne } from "drizzle-orm"

export const dmRouter = router({
  list: publicProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        userId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
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
            eq(directMessageMembers.userId, input.userId),
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
                ne(directMessageMembers.userId, input.userId)
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
        userId: z.string().uuid(),
        otherUserId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if DM room already exists between these users
      const existingRooms = await ctx.db
        .select({ roomId: directMessageMembers.roomId })
        .from(directMessageMembers)
        .where(eq(directMessageMembers.userId, input.userId))

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
        { roomId: dmRoom.id, userId: input.userId },
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
      return ctx.db
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
        })
        .from(messages)
        .innerJoin(users, eq(messages.userId, users.id))
        .where(eq(messages.dmRoomId, input.roomId))
        .orderBy(asc(messages.createdAt))
        .limit(input.limit)
    }),
})
