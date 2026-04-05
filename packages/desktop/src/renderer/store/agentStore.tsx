import { useState, useCallback, createContext, useContext } from "react"
import type { ReactNode } from "react"

export type AgentSession = {
  id: string
  name: string
  history: unknown[]
}

type AgentStore = {
  cwd: string | null
  setCwd: (path: string | null) => void
  sessions: AgentSession[]
  activeSessionId: string | null
  setActiveSession: (id: string) => void
  createSession: () => void
  updateSessionHistory: (id: string, history: unknown[]) => void
}

const AgentContext = createContext<AgentStore | null>(null)

let counter = 1
function makeSession(): AgentSession {
  return { id: `s-${Date.now()}-${counter++}`, name: `Chat ${counter - 1}`, history: [] }
}

const FIRST_SESSION = makeSession()

export function AgentStoreProvider({ children }: { children: ReactNode }) {
  const [cwd, setCwdState] = useState<string | null>(null)
  const [sessions, setSessions] = useState<AgentSession[]>([FIRST_SESSION])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(FIRST_SESSION.id)

  const setCwd = useCallback((path: string | null) => setCwdState(path), [])
  const setActiveSession = useCallback((id: string) => setActiveSessionId(id), [])

  const createSession = useCallback(() => {
    const s = makeSession()
    setSessions((prev) => [...prev, s])
    setActiveSessionId(s.id)
  }, [])

  const updateSessionHistory = useCallback((id: string, history: unknown[]) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, history } : s)))
  }, [])

  return (
    <AgentContext.Provider
      value={{ cwd, setCwd, sessions, activeSessionId, setActiveSession, createSession, updateSessionHistory }}
    >
      {children}
    </AgentContext.Provider>
  )
}

export function useAgentStore(): AgentStore {
  const ctx = useContext(AgentContext)
  if (!ctx) throw new Error("useAgentStore must be used within AgentStoreProvider")
  return ctx
}
