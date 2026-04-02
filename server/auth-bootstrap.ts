import { randomUUID } from "crypto"
import { and, asc, eq } from "drizzle-orm"
import { db } from "@/server/db"
import {
  channelMembers,
  channels,
  messages,
  users,
  workspaceMembers,
} from "@/server/db/schema"

type SessionUser = {
  name?: string | null
  email?: string | null
  image?: string | null
}

const DEFAULT_CHANNELS = [
  {
    name: "general",
    slug: "general",
    description: "Company-wide announcements and updates",
  },
  {
    name: "random",
    slug: "random",
    description: "Non-work chatter, memes, and fun stuff",
  },
  {
    name: "engineering",
    slug: "engineering",
    description: "Engineering discussions and code reviews",
  },
] as const

function normalizeChannelName(name: string) {
  return name.trim().toLowerCase()
}

function normalizeDisplayName(user: SessionUser) {
  if (user.name && user.name.trim()) return user.name.trim()
  if (user.email && user.email.includes("@")) {
    return user.email.split("@")[0]
  }
  return "User"
}

async function ensureUser(user: SessionUser) {
  const email = user.email?.trim().toLowerCase()
  if (!email) {
    throw new Error("Authenticated session is missing user email")
  }

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
  if (existing) {
    const nextName = normalizeDisplayName(user)
    const nextAvatar = user.image?.trim() || null

    if (existing.name !== nextName || (existing.avatarUrl || null) !== nextAvatar) {
      const [updated] = await db
        .update(users)
        .set({
          name: nextName,
          avatarUrl: nextAvatar,
        })
        .where(eq(users.id, existing.id))
        .returning()
      return updated ?? existing
    }

    return existing
  }

  const [created] = await db
    .insert(users)
    .values({
      name: normalizeDisplayName(user),
      email,
      avatarUrl: user.image?.trim() || null,
    })
    .returning()

  if (!created) {
    throw new Error("Failed to create authenticated user")
  }

  return created
}

async function ensureDefaultChannels(workspaceId: string, userId: string) {
  const existingChannels = await db
    .select()
    .from(channels)
    .where(eq(channels.workspaceId, workspaceId))
    .orderBy(asc(channels.createdAt))

  for (const def of DEFAULT_CHANNELS) {
    const targetName = normalizeChannelName(def.name)
    const matches = existingChannels.filter(
      (channel) => normalizeChannelName(channel.name) === targetName
    )
    if (matches.length <= 1) continue

    const canonical = matches[0]
    const duplicates = matches.slice(1)

    for (const duplicate of duplicates) {
      const duplicateMembers = await db
        .select()
        .from(channelMembers)
        .where(eq(channelMembers.channelId, duplicate.id))

      for (const member of duplicateMembers) {
        const [exists] = await db
          .select()
          .from(channelMembers)
          .where(
            and(
              eq(channelMembers.channelId, canonical.id),
              eq(channelMembers.userId, member.userId)
            )
          )
          .limit(1)

        if (!exists) {
          await db.insert(channelMembers).values({
            id: randomUUID(),
            channelId: canonical.id,
            userId: member.userId,
          })
        }
      }

      await db
        .update(messages)
        .set({ channelId: canonical.id })
        .where(eq(messages.channelId, duplicate.id))

      await db.delete(channelMembers).where(eq(channelMembers.channelId, duplicate.id))
      await db.delete(channels).where(eq(channels.id, duplicate.id))
    }
  }

  for (const def of DEFAULT_CHANNELS) {
    const allChannels = await db
      .select()
      .from(channels)
      .where(eq(channels.workspaceId, workspaceId))
      .orderBy(asc(channels.createdAt))
    const found = allChannels.find(
      (channel) => normalizeChannelName(channel.name) === normalizeChannelName(def.name)
    )

    const channel =
      found ||
      (
        await db
          .insert(channels)
          .values({
            id: randomUUID(),
            workspaceId,
            name: normalizeChannelName(def.name),
            slug: def.slug,
            description: def.description,
          })
          .returning()
      )[0]

    if (!channel) continue

    const [channelMembership] = await db
      .select()
      .from(channelMembers)
      .where(
        and(
          eq(channelMembers.channelId, channel.id),
          eq(channelMembers.userId, userId)
        )
      )
      .limit(1)

    if (!channelMembership) {
      await db.insert(channelMembers).values({
        id: randomUUID(),
        channelId: channel.id,
        userId,
      })
    }
  }
}

export async function bootstrapUserWorkspace(sessionUser: SessionUser) {
  const user = await ensureUser(sessionUser)

  const memberships = await db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, user.id))
    .orderBy(asc(workspaceMembers.joinedAt))

  if (memberships.length === 0) {
    return {
      userId: user.id,
      workspaceId: null,
      hasMembership: false,
    }
  }

  const workspaceId = memberships[memberships.length - 1].workspaceId
  await ensureDefaultChannels(workspaceId, user.id)

  return {
    userId: user.id,
    workspaceId,
    hasMembership: true,
  }
}
