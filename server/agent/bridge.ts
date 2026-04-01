import { randomUUID } from "crypto"

type BridgeEvent = {
  id: string
  seq: number
  ts: number
  type: string
  payload: Record<string, unknown>
}

type BridgeSubscriber = (event: BridgeEvent) => void

type BridgeSession = {
  id: string
  token: string
  createdAt: number
  updatedAt: number
  state: Record<string, unknown>
  nextSeq: number
  events: BridgeEvent[]
}

const BRIDGE_EVENT_LIMIT = 500
const sessions = new Map<string, BridgeSession>()
const subscribers = new Map<string, Set<BridgeSubscriber>>()

export function createBridgeSession() {
  const id = randomUUID()
  const token = randomUUID()
  sessions.set(id, {
    id,
    token,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    state: {},
    nextSeq: 1,
    events: [],
  })
  return { id, token }
}

export function pushBridgeEvent(
  sessionId: string,
  type: string,
  payload: Record<string, unknown>
) {
  const session = sessions.get(sessionId)
  if (!session) return false
  const event = {
    id: randomUUID(),
    seq: session.nextSeq++,
    ts: Date.now(),
    type,
    payload,
  }
  session.events.push(event)
  session.updatedAt = Date.now()
  if (session.events.length > BRIDGE_EVENT_LIMIT) {
    session.events.splice(0, session.events.length - BRIDGE_EVENT_LIMIT)
  }
  const listeners = subscribers.get(sessionId)
  if (listeners?.size) {
    for (const listener of listeners) {
      listener(event)
    }
  }
  return true
}

export function listBridgeEvents(
  sessionId: string,
  options?: { sinceTs?: number; afterSeq?: number }
) {
  const session = sessions.get(sessionId)
  if (!session) return null
  if (options?.afterSeq != null) {
    return session.events.filter((event) => event.seq > options.afterSeq!)
  }
  if (options?.sinceTs != null) {
    return session.events.filter((event) => event.ts > options.sinceTs!)
  }
  return session.events
}

export function getBridgeSession(sessionId: string) {
  return sessions.get(sessionId) || null
}

export function authenticateBridgeSession(sessionId: string, token: string) {
  const session = sessions.get(sessionId)
  if (!session) return false
  return session.token === token
}

export function updateBridgeSessionState(
  sessionId: string,
  patch: Record<string, unknown>
) {
  const session = sessions.get(sessionId)
  if (!session) return false
  session.state = { ...session.state, ...patch }
  session.updatedAt = Date.now()
  return true
}

export function getBridgeSessionState(sessionId: string) {
  const session = sessions.get(sessionId)
  if (!session) return null
  return {
    state: session.state,
    updatedAt: session.updatedAt,
    nextSeq: session.nextSeq,
  }
}

export function subscribeBridgeSession(
  sessionId: string,
  listener: BridgeSubscriber
) {
  const set = subscribers.get(sessionId) || new Set<BridgeSubscriber>()
  set.add(listener)
  subscribers.set(sessionId, set)
  return () => {
    const current = subscribers.get(sessionId)
    if (!current) return
    current.delete(listener)
    if (!current.size) {
      subscribers.delete(sessionId)
    }
  }
}
