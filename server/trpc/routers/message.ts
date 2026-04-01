import { z } from "zod"
import { router, publicProcedure } from "../trpc"
import {
  messages,
  users,
  channels,
  directMessageRooms,
  directMessageMembers,
} from "../../db/schema"
import { eq, and, isNull, desc, asc, sql, count, inArray } from "drizzle-orm"

export const messageRouter = router({
  // Get message counts per channel and DM room for unread tracking
  counts: publicProcedure
    .input(
      z.object({
        channelIds: z.array(z.string().uuid()),
        dmRoomIds: z.array(z.string().uuid()),
      })
    )
    .query(async ({ ctx, input }) => {
      const result: Record<string, number> = {}

      if (input.channelIds.length > 0) {
        const channelCounts = await ctx.db
          .select({
            channelId: messages.channelId,
            count: count(),
          })
          .from(messages)
          .where(
            and(
              inArray(messages.channelId, input.channelIds),
              isNull(messages.parentId)
            )
          )
          .groupBy(messages.channelId)

        for (const row of channelCounts) {
          if (row.channelId) result[row.channelId] = row.count
        }
      }

      if (input.dmRoomIds.length > 0) {
        const dmCounts = await ctx.db
          .select({
            dmRoomId: messages.dmRoomId,
            count: count(),
          })
          .from(messages)
          .where(inArray(messages.dmRoomId, input.dmRoomIds))
          .groupBy(messages.dmRoomId)

        for (const row of dmCounts) {
          if (row.dmRoomId) result[row.dmRoomId] = row.count
        }
      }

      return result
    }),

  list: publicProcedure
    .input(
      z.object({
        channelId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
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
        })
        .from(messages)
        .innerJoin(users, eq(messages.userId, users.id))
        .where(
          and(
            eq(messages.channelId, input.channelId),
            isNull(messages.parentId)
          )
        )
        .orderBy(asc(messages.createdAt))
        .limit(input.limit)

      return rows
    }),

  send: publicProcedure
    .input(
      z.object({
        channelId: z.string().uuid().optional(),
        dmRoomId: z.string().uuid().optional(),
        userId: z.string().uuid(),
        content: z.string().min(1),
        parentId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [message] = await ctx.db
        .insert(messages)
        .values({
          channelId: input.channelId,
          dmRoomId: input.dmRoomId,
          userId: input.userId,
          content: input.content,
          parentId: input.parentId,
        })
        .returning()

      // Increment reply count on parent
      if (input.parentId) {
        await ctx.db
          .update(messages)
          .set({ replyCount: sql`${messages.replyCount} + 1` })
          .where(eq(messages.id, input.parentId))
      }

      return message
    }),

  thread: publicProcedure
    .input(z.object({ parentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Get parent message
      const [parent] = await ctx.db
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
        .where(eq(messages.id, input.parentId))

      // Get replies
      const replies = await ctx.db
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
        .where(eq(messages.parentId, input.parentId))
        .orderBy(asc(messages.createdAt))

      return { parent, replies }
    }),
})
