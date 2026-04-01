import fs from "fs/promises"
import path from "path"

const HISTORY_DIR = path.join(process.cwd(), ".staged-agent", "history")

type HistoryEvent = {
  ts: string
  conversationId: string
  type: string
  payload: Record<string, unknown>
}

function sanitizeFileName(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_")
}

async function appendHistoryEvent(event: HistoryEvent) {
  await fs.mkdir(HISTORY_DIR, { recursive: true })
  const filePath = path.join(
    HISTORY_DIR,
    `${sanitizeFileName(event.conversationId)}.jsonl`
  )
  await fs.appendFile(filePath, `${JSON.stringify(event)}\n`, "utf-8")
}

export async function logConversationEvent(
  conversationId: string,
  type: string,
  payload: Record<string, unknown>
) {
  try {
    await appendHistoryEvent({
      ts: new Date().toISOString(),
      conversationId,
      type,
      payload,
    })
  } catch {
    // Non-fatal: logging should never break the chat flow.
  }
}

