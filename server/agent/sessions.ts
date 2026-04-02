import { and, asc, desc, eq } from "drizzle-orm"
import { db } from "@/server/db"
import { agentEvents, agentSessions } from "@/server/db/schema"

export type SessionMetadata = {
  conversationId: string
  title?: string
  tag?: string | null
  createdAt: string
  updatedAt: string
}

type TouchOptions = {
  title?: string
  tag?: string | null
  projectPath?: string | null
  modelId?: string | null
}

export async function touchSession(
  userId: string,
  conversationId: string,
  options?: TouchOptions
) {
  const now = new Date()
  const [existing] = await db
    .select()
    .from(agentSessions)
    .where(
      and(
        eq(agentSessions.userId, userId),
        eq(agentSessions.conversationId, conversationId)
      )
    )
    .limit(1)

  if (existing) {
    await db
      .update(agentSessions)
      .set({
        updatedAt: now,
        title: options?.title ?? existing.title,
        tag:
          options?.tag !== undefined
            ? options.tag
            : (existing.tag ?? null),
        projectPath:
          options?.projectPath !== undefined
            ? options.projectPath
            : existing.projectPath,
        modelId:
          options?.modelId !== undefined
            ? options.modelId
            : existing.modelId,
      })
      .where(eq(agentSessions.id, existing.id))
    return
  }

  await db.insert(agentSessions).values({
    userId,
    conversationId,
    title: options?.title,
    tag: options?.tag ?? null,
    projectPath: options?.projectPath ?? null,
    modelId: options?.modelId ?? null,
    createdAt: now,
    updatedAt: now,
  })
}

export async function listSessions(userId: string): Promise<SessionMetadata[]> {
  const rows = await db
    .select()
    .from(agentSessions)
    .where(eq(agentSessions.userId, userId))
    .orderBy(desc(agentSessions.updatedAt))

  return rows.map((row) => ({
    conversationId: row.conversationId,
    title: row.title || undefined,
    tag: row.tag ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }))
}

export async function renameSession(
  userId: string,
  conversationId: string,
  title: string
) {
  await touchSession(userId, conversationId, { title })
}

export async function tagSession(
  userId: string,
  conversationId: string,
  tag: string | null
) {
  await touchSession(userId, conversationId, { tag })
}

export async function forkSession(
  userId: string,
  sourceConversationId: string,
  targetConversationId: string
) {
  const [source] = await db
    .select()
    .from(agentSessions)
    .where(
      and(
        eq(agentSessions.userId, userId),
        eq(agentSessions.conversationId, sourceConversationId)
      )
    )
    .limit(1)

  const sourceEvents = await db
    .select()
    .from(agentEvents)
    .where(
      and(
        eq(agentEvents.userId, userId),
        eq(agentEvents.conversationId, sourceConversationId)
      )
    )
    .orderBy(asc(agentEvents.ts))

  if (sourceEvents.length > 0) {
    await db.insert(agentEvents).values(
      sourceEvents.map((event) => ({
        userId,
        conversationId: targetConversationId,
        ts: event.ts,
        type: event.type,
        payload: event.payload,
      }))
    )
  }

  await touchSession(userId, targetConversationId, {
    title: source?.title || undefined,
    tag: source?.tag ?? null,
    projectPath: source?.projectPath ?? null,
    modelId: source?.modelId ?? null,
  })
}
