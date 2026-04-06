import { useRef, useEffect, useState } from "react"
import { Loader2, Sparkles } from "lucide-react"

const BASE_URL = import.meta.env.DEV
  ? "http://localhost:3000"
  : "https://staged-qfza.onrender.com"

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        src?: string
        partition?: string
        allowpopups?: string
        style?: React.CSSProperties
      }
    }
  }
}

export function WebSection({ path }: { path: string }) {
  const ref = useRef<HTMLElement>(null)
  const [loading, setLoading] = useState(true)
  const [signingIn, setSigningIn] = useState(false)
  const url = `${BASE_URL}${path}`

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onStart = () => setLoading(true)
    const onStop = () => setLoading(false)
    const onFail = () => setLoading(false)

    el.addEventListener("did-start-loading", onStart)
    el.addEventListener("did-stop-loading", onStop)
    el.addEventListener("did-fail-load", onFail)

    return () => {
      el.removeEventListener("did-start-loading", onStart)
      el.removeEventListener("did-stop-loading", onStop)
      el.removeEventListener("did-fail-load", onFail)
    }
  }, [])

  // Listen for auth events from main process
  useEffect(() => {
    const offStarted = window.api.onAuthStarted(() => {
      setSigningIn(true)
    })

    const offComplete = window.api.onAuthComplete(() => {
      setSigningIn(false)
      const el = ref.current
      if (el) {
        // @ts-expect-error webview method
        el.reload()
      }
    })

    return () => {
      offStarted()
      offComplete()
    }
  }, [])

  return (
    <div className="relative h-full w-full">
      {/* Initial page load spinner */}
      {loading && !signingIn && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0d0d0d]">
          <Loader2 size={20} className="animate-spin text-white/20" />
        </div>
      )}

      {/* Auth waiting overlay */}
      {signingIn && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0d0d0d]">
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
              <Sparkles size={22} className="text-white/50" />
            </div>
            <div className="space-y-1.5">
              <p className="text-[15px] font-semibold text-white/90">
                Signing you in...
              </p>
              <p className="text-[13px] text-white/40">
                Complete sign-in in the window that just opened.
              </p>
            </div>
            <Loader2 size={16} className="animate-spin text-white/20" />
          </div>
        </div>
      )}

      {/* @ts-expect-error webview is an Electron-specific element */}
      <webview
        ref={ref}
        src={url}
        partition="persist:webapp"
        style={{ width: "100%", height: "100%", display: "flex" }}
      />
    </div>
  )
}
