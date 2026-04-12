import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, publicProcedure } from "../trpc"
import { messages, users, directMessageMembers } from "../../db/schema"
import { eq, and, isNull, desc, asc, sql, count, inArray } from "drizzle-orm"

let messagesMigrated = false
async function ensureMessageAttachmentsColumn(db: {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>
}) {
  if (messagesMigrated) return
  await db.execute(sql`
    alter table messages
    add column if not exists attachments jsonb not null default '[]'::jsonb
  `)
  messagesMigrated = true
}

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
      await ensureMessageAttachmentsColumn(ctx.db)
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

      const parentIds = rows.map((row) => row.id)
      const replyPreviewByParent = new Map<
        string,
        Array<{ id: string; name: string; avatarUrl: string | null }>
      >()

      if (parentIds.length > 0) {
        const replyRows = await ctx.db
          .select({
            parentId: messages.parentId,
            userId: users.id,
            userName: users.name,
            userAvatar: users.avatarUrl,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .innerJoin(users, eq(messages.userId, users.id))
          .where(inArray(messages.parentId, parentIds))
          .orderBy(desc(messages.createdAt))

        for (const reply of replyRows) {
          if (!reply.parentId) continue
          const existing = replyPreviewByParent.get(reply.parentId) ?? []
          if (existing.some((user) => user.id === reply.userId)) continue
          if (existing.length >= 4) continue
          existing.push({
            id: reply.userId,
            name: reply.userName,
            avatarUrl: reply.userAvatar,
          })
          replyPreviewByParent.set(reply.parentId, existing)
        }
      }

      return rows.map((row) => ({
        ...row,
        replyPreviewUsers: replyPreviewByParent.get(row.id) ?? [],
      }))
    }),

  send: publicProcedure
    .input(
      z.object({
        channelId: z.string().uuid().optional(),
        dmRoomId: z.string().uuid().optional(),
        userId: z.string().uuid(),
        content: z.string(),
        parentId: z.string().uuid().optional(),
        attachments: z
          .array(
            z.object({
              url: z.string(),
              name: z.string(),
              size: z.number(),
              contentType: z.string(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureMessageAttachmentsColumn(ctx.db)
      if (!ctx.userId || ctx.userId !== input.userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Authentication required",
        })
      }

      if (!input.channelId && !input.dmRoomId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Message must target a channel or DM room",
        })
      }

      if (input.dmRoomId) {
        const [membership] = await ctx.db
          .select({ userId: directMessageMembers.userId })
          .from(directMessageMembers)
          .where(
            and(
              eq(directMessageMembers.roomId, input.dmRoomId),
              eq(directMessageMembers.userId, ctx.userId)
            )
          )
          .limit(1)

        if (!membership) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You are not a member of this DM room",
          })
        }
      }

      const [message] = await ctx.db
        .insert(messages)
        .values({
          channelId: input.channelId,
          dmRoomId: input.dmRoomId,
          userId: input.userId,
          content: input.content,
          parentId: input.parentId,
          attachments: input.attachments ?? [],
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
      await ensureMessageAttachmentsColumn(ctx.db)
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
          attachments: messages.attachments,
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
          attachments: messages.attachments,
        })
        .from(messages)
        .innerJoin(users, eq(messages.userId, users.id))
        .where(eq(messages.parentId, input.parentId))
        .orderBy(asc(messages.createdAt))

      return {
        parent: parent
          ? {
              ...parent,
              replyPreviewUsers: [] as Array<{
                id: string
                name: string
                avatarUrl: string | null
              }>,
            }
          : undefined,
        replies: replies.map((r) => ({
          ...r,
          replyPreviewUsers: [] as Array<{
            id: string
            name: string
            avatarUrl: string | null
          }>,
        })),
      }
    }),

  delete: publicProcedure
    .input(
      z.object({
        messageId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Authentication required",
        })
      }

      const [target] = await ctx.db
        .select({
          id: messages.id,
          userId: messages.userId,
          parentId: messages.parentId,
          channelId: messages.channelId,
          dmRoomId: messages.dmRoomId,
        })
        .from(messages)
        .where(eq(messages.id, input.messageId))
        .limit(1)

      if (!target) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        })
      }

      if (target.userId !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete your own messages",
        })
      }

      await ctx.db.delete(messages).where(eq(messages.id, input.messageId))

      if (target.parentId) {
        await ctx.db
          .update(messages)
          .set({ replyCount: sql`GREATEST(${messages.replyCount} - 1, 0)` })
          .where(eq(messages.id, target.parentId))
      }

      return {
        ok: true,
        deletedId: target.id,
        channelId: target.channelId,
        dmRoomId: target.dmRoomId,
        parentId: target.parentId,
      }
    }),
})
