import fs from "fs/promises"
import path from "path"
import os from "os"
import type { ModelMessage } from "ai"

const SESSION_DIR = path.join(os.homedir(), ".staged-agent", "sessions")

export type Session = {
  sessionId: string
  messages: ModelMessage[]
}

export async function loadSession(sessionId: string): Promise<Session> {
  try {
    const filePath = path.join(SESSION_DIR, `${sessionId}.json`)
    const raw = await fs.readFile(filePath, "utf-8")
    const parsed = JSON.parse(raw) as Partial<Session>
    return {
      sessionId,
      messages: Array.isArray(parsed.messages) ? (parsed.messages as ModelMessage[]) : [],
    }
  } catch {
    return { sessionId, messages: [] }
  }
}

export async function saveSession(session: Session): Promise<void> {
  try {
    await fs.mkdir(SESSION_DIR, { recursive: true })
    const filePath = path.join(SESSION_DIR, `${session.sessionId}.json`)
    await fs.writeFile(filePath, JSON.stringify(session, null, 2), "utf-8")
  } catch {
    // non-fatal — session persistence is best-effort
  }
}
