import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, publicProcedure } from "../trpc"
import {
  messages,
  users,
  directMessageMembers,
  messageReactions,
} from "../../db/schema"
import { eq, and, isNull, desc, asc, sql, count, inArray } from "drizzle-orm"

type ReactionSummary = {
  emoji: string
  count: number
  reactedByMe: boolean
  users: Array<{ id: string; name: string }>
}

type Db = {
  select: (...args: unknown[]) => {
    from: (table: unknown) => {
      innerJoin: (
        other: unknown,
        on: unknown
      ) => {
        where: (pred: unknown) => Promise<unknown[]>
      }
    }
  }
}

async function loadReactionsFor(
  db: unknown,
  messageIds: string[],
  currentUserId: string | null
) {
  const map = new Map<string, ReactionSummary[]>()
  if (messageIds.length === 0) return map
  const rows = (await (db as Db)
    .select({
      messageId: messageReactions.messageId,
      emoji: messageReactions.emoji,
      userId: messageReactions.userId,
      userName: users.name,
    })
    .from(messageReactions)
    .innerJoin(users, eq(messageReactions.userId, users.id))
    .where(inArray(messageReactions.messageId, messageIds))) as Array<{
    messageId: string
    emoji: string
    userId: string
    userName: string
  }>
  for (const row of rows) {
    const list = map.get(row.messageId) ?? []
    let entry = list.find((r) => r.emoji === row.emoji)
    if (!entry) {
      entry = { emoji: row.emoji, count: 0, reactedByMe: false, users: [] }
      list.push(entry)
    }
    entry.count += 1
    if (row.userId === currentUserId) entry.reactedByMe = true
    entry.users.push({ id: row.userId, name: row.userName })
    map.set(row.messageId, list)
  }
  return map
}

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
          isPinned: messages.isPinned,
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

      const reactionsByMessage = await loadReactionsFor(
        ctx.db,
        parentIds,
        ctx.userId ?? null
      )

      return rows.map((row) => ({
        ...row,
        replyPreviewUsers: replyPreviewByParent.get(row.id) ?? [],
        reactions: reactionsByMessage.get(row.id) ?? [],
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
          isPinned: messages.isPinned,
        })
        .from(messages)
        .innerJoin(users, eq(messages.userId, users.id))
        .where(eq(messages.id, input.parentId))

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
          isPinned: messages.isPinned,
        })
        .from(messages)
        .innerJoin(users, eq(messages.userId, users.id))
        .where(eq(messages.parentId, input.parentId))
        .orderBy(asc(messages.createdAt))

      const allIds = [
        ...(parent ? [parent.id] : []),
        ...replies.map((r) => r.id),
      ]
      const reactionsByMessage = await loadReactionsFor(
        ctx.db,
        allIds,
        ctx.userId ?? null
      )

      return {
        parent: parent
          ? {
              ...parent,
              replyPreviewUsers: [] as Array<{
                id: string
                name: string
                avatarUrl: string | null
              }>,
              reactions: reactionsByMessage.get(parent.id) ?? [],
            }
          : undefined,
        replies: replies.map((r) => ({
          ...r,
          replyPreviewUsers: [] as Array<{
            id: string
            name: string
            avatarUrl: string | null
          }>,
          reactions: reactionsByMessage.get(r.id) ?? [],
        })),
      }
    }),

  toggleReaction: publicProcedure
    .input(
      z.object({
        messageId: z.string().uuid(),
        emoji: z.string().min(1).max(32),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }
      const [existing] = await ctx.db
        .select({ id: messageReactions.id })
        .from(messageReactions)
        .where(
          and(
            eq(messageReactions.messageId, input.messageId),
            eq(messageReactions.userId, ctx.userId),
            eq(messageReactions.emoji, input.emoji)
          )
        )
        .limit(1)

      if (existing) {
        await ctx.db
          .delete(messageReactions)
          .where(eq(messageReactions.id, existing.id))
        return { removed: true }
      }
      await ctx.db.insert(messageReactions).values({
        messageId: input.messageId,
        userId: ctx.userId,
        emoji: input.emoji,
      })
      return { removed: false }
    }),

  togglePin: publicProcedure
    .input(z.object({ messageId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" })
      }
      const [target] = await ctx.db
        .select({ id: messages.id, isPinned: messages.isPinned })
        .from(messages)
        .where(eq(messages.id, input.messageId))
        .limit(1)
      if (!target) throw new TRPCError({ code: "NOT_FOUND" })
      const next = !target.isPinned
      await ctx.db
        .update(messages)
        .set({
          isPinned: next,
          pinnedAt: next ? new Date() : null,
          pinnedById: next ? ctx.userId : null,
        })
        .where(eq(messages.id, input.messageId))
      return { isPinned: next }
    }),

  listPinned: publicProcedure
    .input(z.object({ channelId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: messages.id,
          content: messages.content,
          createdAt: messages.createdAt,
          pinnedAt: messages.pinnedAt,
          attachments: messages.attachments,
          userId: messages.userId,
          userName: users.name,
          userAvatar: users.avatarUrl,
        })
        .from(messages)
        .innerJoin(users, eq(messages.userId, users.id))
        .where(
          and(
            eq(messages.channelId, input.channelId),
            eq(messages.isPinned, true)
          )
        )
        .orderBy(desc(messages.pinnedAt))
    }),

  listFiles: publicProcedure
    .input(z.object({ channelId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: messages.id,
          createdAt: messages.createdAt,
          attachments: messages.attachments,
          userName: users.name,
        })
        .from(messages)
        .innerJoin(users, eq(messages.userId, users.id))
        .where(eq(messages.channelId, input.channelId))
        .orderBy(desc(messages.createdAt))

      const files: Array<{
        messageId: string
        createdAt: Date
        userName: string
        url: string
        name: string
        size: number
        contentType: string
      }> = []
      for (const row of rows) {
        for (const att of row.attachments ?? []) {
          files.push({
            messageId: row.id,
            createdAt: row.createdAt,
            userName: row.userName,
            ...att,
          })
        }
      }
      return files
    }),

  listLinks: publicProcedure
    .input(z.object({ channelId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: messages.id,
          content: messages.content,
          createdAt: messages.createdAt,
          userName: users.name,
        })
        .from(messages)
        .innerJoin(users, eq(messages.userId, users.id))
        .where(eq(messages.channelId, input.channelId))
        .orderBy(desc(messages.createdAt))

      const urlRegex = /(https?:\/\/[^\s<>"']+)/g
      const links: Array<{
        messageId: string
        createdAt: Date
        userName: string
        url: string
      }> = []
      const seen = new Set<string>()
      for (const row of rows) {
        const matches = row.content.matchAll(urlRegex)
        for (const match of matches) {
          const url = match[1]
          if (seen.has(row.id + url)) continue
          seen.add(row.id + url)
          links.push({
            messageId: row.id,
            createdAt: row.createdAt,
            userName: row.userName,
            url,
          })
        }
      }
      return links
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
