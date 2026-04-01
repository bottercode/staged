import fs from "fs/promises"
import path from "path"

const AGENT_DIR = path.join(process.cwd(), ".staged-agent")
const SESSION_INDEX_PATH = path.join(AGENT_DIR, "sessions.json")
const HISTORY_DIR = path.join(AGENT_DIR, "history")

export type SessionMetadata = {
  conversationId: string
  title?: string
  tag?: string | null
  createdAt: string
  updatedAt: string
}

async function readSessionIndex(): Promise<Record<string, SessionMetadata>> {
  try {
    const raw = await fs.readFile(SESSION_INDEX_PATH, "utf-8")
    return JSON.parse(raw) as Record<string, SessionMetadata>
  } catch {
    return {}
  }
}

async function writeSessionIndex(index: Record<string, SessionMetadata>) {
  await fs.mkdir(AGENT_DIR, { recursive: true })
  await fs.writeFile(SESSION_INDEX_PATH, JSON.stringify(index, null, 2), "utf-8")
}

export async function touchSession(conversationId: string) {
  const index = await readSessionIndex()
  const now = new Date().toISOString()
  const prev = index[conversationId]
  index[conversationId] = {
    conversationId,
    createdAt: prev?.createdAt || now,
    updatedAt: now,
    title: prev?.title,
    tag: prev?.tag ?? null,
  }
  await writeSessionIndex(index)
}

export async function listSessions(): Promise<SessionMetadata[]> {
  const index = await readSessionIndex()
  return Object.values(index).sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : -1
  )
}

export async function renameSession(conversationId: string, title: string) {
  const index = await readSessionIndex()
  const now = new Date().toISOString()
  const prev = index[conversationId]
  index[conversationId] = {
    conversationId,
    createdAt: prev?.createdAt || now,
    updatedAt: now,
    title,
    tag: prev?.tag ?? null,
  }
  await writeSessionIndex(index)
}

export async function tagSession(conversationId: string, tag: string | null) {
  const index = await readSessionIndex()
  const now = new Date().toISOString()
  const prev = index[conversationId]
  index[conversationId] = {
    conversationId,
    createdAt: prev?.createdAt || now,
    updatedAt: now,
    title: prev?.title,
    tag,
  }
  await writeSessionIndex(index)
}

function sanitize(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_")
}

export async function forkSession(
  sourceConversationId: string,
  targetConversationId: string
) {
  await fs.mkdir(HISTORY_DIR, { recursive: true })
  const src = path.join(HISTORY_DIR, `${sanitize(sourceConversationId)}.jsonl`)
  const dst = path.join(HISTORY_DIR, `${sanitize(targetConversationId)}.jsonl`)
  const raw = await fs.readFile(src, "utf-8").catch(() => "")
  await fs.writeFile(dst, raw, "utf-8")
  await touchSession(targetConversationId)
}

