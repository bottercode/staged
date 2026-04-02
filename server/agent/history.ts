import { and, asc, eq } from "drizzle-orm"
import { db } from "@/server/db"
import { agentEvents } from "@/server/db/schema"

export type HistoryEvent = {
  ts: string
  conversationId: string
  type: string
  payload: Record<string, unknown>
}

function normalizePayload(payload: unknown): Record<string, unknown> {
  if (typeof payload === "object" && payload !== null) {
    return payload as Record<string, unknown>
  }
  return { value: payload }
}

export async function logConversationEvent(
  userId: string,
  conversationId: string,
  type: string,
  payload: Record<string, unknown>
) {
  try {
    await db.insert(agentEvents).values({
      userId,
      conversationId,
      type,
      payload: normalizePayload(payload),
      ts: new Date(),
    })
  } catch {
    // Non-fatal: logging should never break the chat flow.
  }
}

export async function listConversationEvents(
  userId: string,
  conversationId: string
): Promise<HistoryEvent[]> {
  const rows = await db
    .select()
    .from(agentEvents)
    .where(
      and(
        eq(agentEvents.userId, userId),
        eq(agentEvents.conversationId, conversationId)
      )
    )
    .orderBy(asc(agentEvents.ts))

  return rows.map((row) => ({
    ts: row.ts.toISOString(),
    conversationId: row.conversationId,
    type: row.type,
    payload: normalizePayload(row.payload),
  }))
}
