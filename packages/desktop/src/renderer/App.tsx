import { useState, useCallback, useEffect, useRef } from "react"
import { Loader2, ArrowRight } from "lucide-react"
import logo from "./assets/logo.png"
import type { Section } from "./types"
import { AgentSection } from "./sections/AgentSection"
import type { Message } from "./components/ChatPanel"

export type AgentSession = {
  id: string
  name: string
  history: unknown[]
}

const BASE_URL = import.meta.env.DEV
  ? "http://localhost:3000"
  : "https://staged.codula.in"
const DESKTOP_RAIL_WIDTH = 48
const AGENT_OPEN_SETTINGS_REQUEST_KEY = "staged-agent-open-settings-request"
const AGENT_OPEN_FOLDER_REQUEST_KEY = "staged-agent-open-folder-request"
const AGENT_OPEN_FOLDER_RESULT_KEY = "staged-agent-open-folder-result"

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string
        partition?: string
        style?: React.CSSProperties
      }
    }
  }
}

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
      <div className="titlebar-drag absolute inset-x-0 top-0 h-10" />
      <div className="flex w-full max-w-sm flex-col items-center gap-7 text-center">
        <img src={logo} alt="Staged" className="h-16 w-16 rounded-2xl" />
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-white/90">Sign in to Staged</h1>
          <p className="text-[13px] text-white/40">
            Continue with Google to access your workspace.
          </p>
        </div>
        {signingIn ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={18} className="animate-spin text-white/30" />
            <p className="text-[13px] text-white/40">Finish signing in with your browser…</p>
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
  const [section, setSection] = useState<Section>("chat")
  const [webviewLoading, setWebviewLoading] = useState(true)
  const [cwd, setCwdState] = useState<string | null>(null)
  const [session] = useState<AgentSession>(() => ({ id: `s-${Date.now()}`, name: "Chat 1", history: [] }))
  const [sessionHistory, setSessionHistory] = useState<unknown[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [agentEverOpened, setAgentEverOpened] = useState(false)
  const [update, setUpdate] = useState<{ version: string; downloadUrl: string } | null>(null)
  const [agentOverlaySuspended, setAgentOverlaySuspended] = useState(false)
  const webviewRef = useRef<HTMLElement>(null)

  useEffect(() => {
    window.api.checkAuth().then(({ authenticated }) => {
      setAuthStatus(authenticated ? "signed-in" : "signed-out")
    })
  }, [])

  // Hydrate persisted agent session (cwd + messages + history) on startup.
  // Use functional updates so a slow disk read can't clobber state the user
  // has already modified while hydration was pending.
  useEffect(() => {
    let cancelled = false
    window.api
      .getSession()
      .then((s) => {
        if (cancelled) return
        setCwdState((prev) => prev ?? s.cwd)
        setMessages((prev) =>
          prev.length > 0 ? prev : ((s.messages as Message[]) ?? [])
        )
        setSessionHistory((prev) =>
          prev.length > 0 ? prev : (s.history ?? [])
        )
        if (s.cwd || (s.messages && s.messages.length > 0)) {
          setAgentEverOpened(true)
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  // Persist session whenever cwd / messages / history change. Only skip the
  // very first render (pre-hydration / pre-interaction) so we don't overwrite
  // a not-yet-loaded session with an empty default.
  const hasPersistedRef = useRef(false)
  useEffect(() => {
    const shouldPersist =
      hasPersistedRef.current ||
      cwd !== null ||
      messages.length > 0 ||
      sessionHistory.length > 0
    if (!shouldPersist) return
    hasPersistedRef.current = true
    const timer = window.setTimeout(() => {
      void window.api.setSession({
        cwd,
        messages: messages as unknown[],
        history: sessionHistory,
      })
    }, 150)
    return () => window.clearTimeout(timer)
  }, [cwd, messages, sessionHistory])

  const setCwd = useCallback((path: string | null) => {
    setCwdState(path)
    if (path === null) {
      setMessages([])
      setSessionHistory([])
    }
  }, [])

  useEffect(() => {
    const offStarted = window.api.onAuthStarted(() => setSigningIn(true))
    const offComplete = window.api.onAuthComplete(() => {
      setSigningIn(false)
      window.api.checkAuth().then(({ authenticated }) => {
        setAuthStatus(authenticated ? "signed-in" : "signed-out")
      })
      // @ts-expect-error webview method
      webviewRef.current?.reload()
    })
    return () => { offStarted(); offComplete() }
  }, [])

  useEffect(() => {
    return window.api.onSectionSwitch((s) => setSection(s as Section))
  }, [])

  useEffect(() => {
    return window.api.onUpdateAvailable((u) => setUpdate(u))
  }, [])

  // Detect section changes from webview SPA navigation
  useEffect(() => {
    const el = webviewRef.current
    if (!el) return

    const onStart = () => setWebviewLoading(true)
    const onStop = () => setWebviewLoading(false)

    const onNavigateInPage = (e: Event) => {
      const url = (e as CustomEvent & { url: string }).url
      if (!url) return
      if (url.includes("/workspace/agent")) setSection("agent")
      else if (url.includes("/workspace/tasks")) setSection("tasks")
      else if (url.includes("/workspace/docs")) setSection("docs")
      else if (url.includes("/workspace/portals")) setSection("portals")
      else if (url.includes("/workspace")) setSection("chat")
    }

    el.addEventListener("did-start-loading", onStart)
    el.addEventListener("did-stop-loading", onStop)
    el.addEventListener("did-fail-load", onStop)
    el.addEventListener("did-navigate-in-page", onNavigateInPage)
    el.addEventListener("did-navigate", onNavigateInPage)

    return () => {
      el.removeEventListener("did-start-loading", onStart)
      el.removeEventListener("did-stop-loading", onStop)
      el.removeEventListener("did-fail-load", onStop)
      el.removeEventListener("did-navigate-in-page", onNavigateInPage)
      el.removeEventListener("did-navigate", onNavigateInPage)
    }
  }, [authStatus])

  const updateSessionHistory = useCallback((_id: string, history: unknown[]) => {
    setSessionHistory(history)
  }, [])

  useEffect(() => {
    if (section !== "agent") {
      setAgentOverlaySuspended(false)
    } else {
      setAgentEverOpened(true)
    }
  }, [section])

  useEffect(() => {
    if (section !== "agent") return
    let disposed = false
    const interval = window.setInterval(() => {
      // @ts-expect-error webview method
      void webviewRef.current
        ?.executeJavaScript(
          `(() => {
            const collectElements = () => {
              const out = [];
              const queue = [document];
              while (queue.length > 0) {
                const root = queue.shift();
                const nodes = root.querySelectorAll ? root.querySelectorAll("*") : [];
                for (const el of nodes) {
                  out.push(el);
                  if (el.shadowRoot) queue.push(el.shadowRoot);
                }
              }
              return out;
            };
            const allEls = collectElements();

            const hasWorkspaceDialog = Boolean(
              document.querySelector('[data-workspace-settings-dialog]')
            );
            if (hasWorkspaceDialog) return true;

            // Next.js DevTools panes/popovers
            const hasNextDevTools = allEls.some((el) => {
              const id = (el.id || "").toLowerCase();
              const cls = (typeof el.className === "string" ? el.className : "").toLowerCase();
              const aria = (el.getAttribute?.("aria-label") || "").toLowerCase();
              const tag = (el.tagName || "").toLowerCase();
              // Check data-nextjs-* / data-next-* attributes on visible, sizable elements
              const attrs = el.getAttributeNames?.() || [];
              if (attrs.some(a => a.startsWith("data-nextjs") || a.startsWith("data-next-"))) {
                const rect = el.getBoundingClientRect();
                if (rect.width > 100 && rect.height > 60) return true;
              }
              return (
                id.includes("nextjs") ||
                id.includes("devtools") ||
                id.includes("__next") ||
                cls.includes("nextjs") ||
                cls.includes("devtools") ||
                aria.includes("dev tools") ||
                aria.includes("next.js") ||
                aria.includes("nextjs") ||
                tag.includes("nextjs") ||
                tag === "nextjs-portal"
              );
            });
            if (hasNextDevTools) return true;

            const hasDevToolsPrefsPanel = allEls.some((el) => {
              if (!["DIV", "SECTION", "ASIDE"].includes(el.tagName || "")) return false;
              const text = (el.textContent || "").trim();
              if (!text) return false;
              const looksLikePrefs =
                text.includes("Hide Dev Tools for this session") ||
                text.includes("Disable Dev Tools for this project") ||
                text.includes("Hide Dev Tools shortcut");
              if (!looksLikePrefs) return false;
              const rect = el.getBoundingClientRect();
              return rect.width > 180 && rect.height > 120;
            });
            if (hasDevToolsPrefsPanel) return true;

            const hasModal = Boolean(
              document.querySelector('[role="dialog"][aria-modal="true"], [data-state="open"][role="dialog"]')
            );
            if (hasModal) return true;

            // Generic overlay/devtools detection: fixed elements with significant size
            const fixedEls = allEls.filter((el) => {
              const style = window.getComputedStyle(el);
              if (style.position !== "fixed") return false;
              if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
              const rect = el.getBoundingClientRect();
              if (rect.width < 120 || rect.height < 80) return false;
              // Very high z-index = almost certainly a DevTools/overlay panel
              const zIndex = parseInt(style.zIndex) || 0;
              if (zIndex > 9000) return true;
              // Left-rail area overlays (original check)
              return rect.left < 360 && rect.right > 40;
            });
            if (fixedEls.length > 0) return true;

            // Next.js DevTools panel — fixed/sticky + near bottom + elevated z-index
            const viewportHeight = window.innerHeight;
            const bottomPanelEls = allEls.filter((el) => {
              const style = window.getComputedStyle(el);
              if (style.position !== "fixed" && style.position !== "sticky") return false;
              if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
              const zIndex = parseInt(style.zIndex) || 0;
              if (zIndex < 100) return false;
              const rect = el.getBoundingClientRect();
              if (rect.width < 200 || rect.height < 40) return false;
              return rect.top > viewportHeight * 0.65;
            });
            return bottomPanelEls.length > 0;
          })()`
        )
        .then((hasOverlayOpen) => {
          if (disposed || typeof hasOverlayOpen !== "boolean") return
          setAgentOverlaySuspended((prev) =>
            hasOverlayOpen ? true : prev ? false : prev
          )
        })
        .catch(() => undefined)
    }, 250)
    return () => {
      disposed = true
      window.clearInterval(interval)
    }
  }, [section])

  useEffect(() => {
    if (section !== "agent") return
    let disposed = false
    const interval = window.setInterval(() => {
      // @ts-expect-error webview method
      void webviewRef.current
        ?.executeJavaScript(
          `(() => {
            const key = "${AGENT_OPEN_SETTINGS_REQUEST_KEY}";
            const value = localStorage.getItem(key);
            if (!value) return false;
            localStorage.removeItem(key);
            return true;
          })()`
        )
        .then((requested) => {
          if (disposed || requested !== true) return
          setAgentOverlaySuspended(true)
        })
        .catch(() => undefined)
    }, 200)

    return () => {
      disposed = true
      window.clearInterval(interval)
    }
  }, [section])

  // Bridge: webview sets a localStorage flag → we open the native folder dialog → write result back
  useEffect(() => {
    if (section !== "agent") return
    let disposed = false
    const interval = window.setInterval(() => {
      // @ts-expect-error webview method
      void webviewRef.current
        ?.executeJavaScript(
          `(() => {
            const key = "${AGENT_OPEN_FOLDER_REQUEST_KEY}";
            const value = localStorage.getItem(key);
            if (!value) return false;
            localStorage.removeItem(key);
            return true;
          })()`
        )
        .then(async (requested) => {
          if (disposed || requested !== true) return
          const folder = await window.api.openFolder()
          if (!folder || disposed) return
          // @ts-expect-error webview method
          void webviewRef.current?.executeJavaScript(
            `localStorage.setItem(${JSON.stringify(AGENT_OPEN_FOLDER_RESULT_KEY)}, ${JSON.stringify(folder)})`
          )
        })
        .catch(() => undefined)
    }, 200)

    return () => {
      disposed = true
      window.clearInterval(interval)
    }
  }, [section])

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

  const isMac = window.api.platform === "darwin"
  const activeSession = { ...session, history: sessionHistory }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d0d0d] text-white">
      {/* macOS titlebar drag region — sits above everything so traffic lights don't overlap webview content */}
      {isMac && (
        <div
          className="titlebar-drag absolute inset-x-0 top-0 z-50"
          style={{ height: 28 }}
        />
      )}
      <div className="flex flex-1 flex-col overflow-hidden" style={{ paddingTop: isMac ? 28 : 0 }}>
        {/* Update banner */}
        {update && (
          <div className="flex shrink-0 items-center justify-between gap-3 bg-white/[0.06] px-4 py-2 text-[12px]">
            <span className="text-white/60">
              Update <span className="text-white/90 font-medium">v{update.version}</span> is available
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void window.api.downloadUpdate(update.downloadUrl)}
                className="rounded bg-white/90 px-3 py-1 font-medium text-black transition-opacity hover:opacity-80"
              >
                Download
              </button>
              <button
                onClick={() => setUpdate(null)}
                className="text-white/30 hover:text-white/60"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Content: webview always present, agent panel overlaid when in agent mode */}
        <div className="relative flex-1 overflow-hidden">

          {/* Persistent webapp webview */}
          {/* @ts-expect-error webview is Electron-specific */}
          <webview
            ref={webviewRef}
            src={`${BASE_URL}/workspace`}
            partition="persist:webapp"
            className="z-0"
            style={{ width: "100%", height: "100%", display: "flex" }}
          />

          {/* Initial load spinner */}
          {webviewLoading && !signingIn && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0d0d0d]">
              <Loader2 size={20} className="animate-spin text-white/20" />
            </div>
          )}

          {/* Auth waiting overlay */}
          {signingIn && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0d0d0d]">
              <div className="flex flex-col items-center gap-5 text-center">
                <img src={logo} alt="Staged" className="h-12 w-12 rounded-2xl" />
                <div className="space-y-1.5">
                  <p className="text-[15px] font-semibold text-white/90">Signing you in...</p>
                  <p className="text-[13px] text-white/40">Complete sign-in in the window that just opened.</p>
                </div>
                <Loader2 size={16} className="animate-spin text-white/20" />
              </div>
            </div>
          )}

          {/* Agent overlay — kept mounted after first open so chat state survives tab switches */}
          {agentEverOpened && (
            <div
              className="absolute right-0 bottom-0 top-0 z-30 bg-[#0d0d0d]"
              style={{
                left: DESKTOP_RAIL_WIDTH,
                display:
                  section === "agent" && !agentOverlaySuspended
                    ? "block"
                    : "none",
              }}
            >
              <AgentSection
                cwd={cwd}
                setCwd={setCwd}
                session={activeSession}
                messages={messages}
                setMessages={setMessages}
                onHistoryUpdate={updateSessionHistory}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
