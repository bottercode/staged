import { useState, useCallback, useEffect } from "react"
import { Sparkles, Loader2, ArrowRight } from "lucide-react"
import type { Section } from "./types"
import { NavRail } from "./components/NavRail"
import { AgentSidebar } from "./components/sidebars/AgentSidebar"
import { SettingsModal } from "./components/SettingsModal"
import { AgentSection } from "./sections/AgentSection"
import { ChatSection } from "./sections/ChatSection"
import { TasksSection } from "./sections/TasksSection"
import { DocsSection } from "./sections/DocsSection"
import { PortalsSection } from "./sections/PortalsSection"

export type AgentSession = {
  id: string
  name: string
  history: unknown[]
}

let counter = 1
function makeSession(): AgentSession {
  return { id: `s-${Date.now()}-${counter++}`, name: `Chat ${counter - 1}`, history: [] }
}

const WEB_SECTIONS: Section[] = ["chat", "tasks", "docs", "portals"]

// ── Sign-in screen ────────────────────────────────────────

function SignInScreen({
  onSignIn,
  onCancel,
  signingIn,
}: {
  onSignIn: () => void
  onCancel: () => void
  signingIn: boolean
}) {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-[#0d0d0d] px-4">
      {/* macOS traffic-light spacer */}
      <div className="titlebar-drag absolute inset-x-0 top-0 h-10" />

      <div className="flex w-full max-w-sm flex-col items-center gap-7 text-center">
        {/* Icon */}
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/90">
          <Sparkles size={22} className="text-black" />
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-white/90">Sign in to Staged</h1>
          <p className="text-[13px] text-white/40">
            Continue with Google to access your workspace.
          </p>
        </div>

        {/* Button / waiting state */}
        {signingIn ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={18} className="animate-spin text-white/30" />
            <p className="text-[13px] text-white/40">
              Finish signing in with your browser…
            </p>
            <button
              onClick={onCancel}
              className="text-[12px] text-white/25 underline-offset-2 hover:text-white/40 hover:underline transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={onSignIn}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/90 px-4 py-3 text-[14px] font-medium text-black transition-opacity hover:opacity-90 active:opacity-75"
          >
            Continue with Google
            <ArrowRight size={15} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Loading screen ────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#0d0d0d]">
      <div className="titlebar-drag absolute inset-x-0 top-0 h-10" />
      <Loader2 size={18} className="animate-spin text-white/20" />
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────

export default function App() {
  const [authStatus, setAuthStatus] = useState<"checking" | "signed-in" | "signed-out">("checking")
  const [signingIn, setSigningIn] = useState(false)
  const [section, setSection] = useState<Section>("agent")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [cwd, setCwd] = useState<string | null>(null)
  const [sessions, setSessions] = useState<AgentSession[]>(() => [makeSession()])
  const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0].id)

  // Check auth on mount
  useEffect(() => {
    window.api.checkAuth().then(({ authenticated }) => {
      setAuthStatus(authenticated ? "signed-in" : "signed-out")
    })
  }, [])

  // Listen for auth events
  useEffect(() => {
    const offStarted = window.api.onAuthStarted(() => setSigningIn(true))
    const offComplete = window.api.onAuthComplete(() => {
      setSigningIn(false)
      window.api.checkAuth().then(({ authenticated }) => {
        setAuthStatus(authenticated ? "signed-in" : "signed-out")
      })
    })
    return () => { offStarted(); offComplete() }
  }, [])

  // Listen for section switch from webview (e.g. Agent clicked in webapp sidebar)
  useEffect(() => {
    return window.api.onSectionSwitch((s) => setSection(s as Section))
  }, [])

  const createSession = useCallback(() => {
    const s = makeSession()
    setSessions((prev) => [...prev, s])
    setActiveSessionId(s.id)
  }, [])

  const closeSession = useCallback((id: string) => {
    setSessions((prev) => {
      if (prev.length <= 1) return prev
      const filtered = prev.filter((s) => s.id !== id)
      if (id === activeSessionId) {
        setActiveSessionId(filtered[filtered.length - 1].id)
      }
      return filtered
    })
  }, [activeSessionId])

  const updateSessionHistory = useCallback((id: string, history: unknown[]) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, history } : s)))
  }, [])

  // Auth gates
  if (authStatus === "checking") return <LoadingScreen />
  if (authStatus === "signed-out") {
    return (
      <SignInScreen
        signingIn={signingIn}
        onSignIn={() => { setSigningIn(true); void window.api.signIn() }}
        onCancel={() => setSigningIn(false)}
      />
    )
  }

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? sessions[0]
  const isWebSection = WEB_SECTIONS.includes(section)

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d0d0d] text-white">
      {/* Agent: NavRail + native sidebar + local chat */}
      {section === "agent" && (
        <>
          <NavRail
            active={section}
            onSelect={setSection}
            onSettings={() => setSettingsOpen(true)}
          />
          {sidebarCollapsed ? (
            <aside className="flex w-8 shrink-0 flex-col items-center border-r border-white/[0.05] bg-[#0a0a0a]">
              <div className="titlebar-drag h-10 shrink-0" />
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="mt-1 flex h-7 w-7 items-center justify-center rounded-md text-white/25 transition-colors hover:bg-white/[0.06] hover:text-white/50"
                title="Expand sidebar"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </aside>
          ) : (
            <aside className="flex w-56 shrink-0 flex-col border-r border-white/[0.05] bg-[#0a0a0a]">
              <div className="titlebar-drag h-10 shrink-0" />
              <div className="flex-1 overflow-y-auto">
                <AgentSidebar
                  cwd={cwd}
                  sessions={sessions}
                  activeSessionId={activeSessionId}
                  onSelectSession={setActiveSessionId}
                  onNewSession={createSession}
                  onCloseSession={closeSession}
                  onCollapse={() => setSidebarCollapsed(true)}
                />
              </div>
            </aside>
          )}
          <main className="flex flex-1 flex-col overflow-hidden">
            <div className="titlebar-drag h-10 shrink-0 border-b border-white/[0.05]" />
            <div className="flex-1 overflow-hidden">
              <AgentSection
                cwd={cwd}
                setCwd={setCwd}
                session={activeSession}
                onHistoryUpdate={updateSessionHistory}
              />
            </div>
          </main>
        </>
      )}

      {/* Web sections: webview fills the full window, webapp sidebar handles nav */}
      {isWebSection && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="titlebar-drag h-10 shrink-0" />
          <div className="flex-1 overflow-hidden">
            {section === "chat" && <ChatSection />}
            {section === "tasks" && <TasksSection />}
            {section === "docs" && <DocsSection />}
            {section === "portals" && <PortalsSection />}
          </div>
        </div>
      )}

      {settingsOpen && (
        <SettingsModal onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  )
}
