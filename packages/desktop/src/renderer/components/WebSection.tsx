import { useRef, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

const BASE_URL = "https://staged-qfza.onrender.com"

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
  const url = `${BASE_URL}${path}`

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onStart = () => setLoading(true)
    const onStop = () => setLoading(false)

    el.addEventListener("did-start-loading", onStart)
    el.addEventListener("did-stop-loading", onStop)
    el.addEventListener("did-fail-load", onStop)

    return () => {
      el.removeEventListener("did-start-loading", onStart)
      el.removeEventListener("did-stop-loading", onStop)
      el.removeEventListener("did-fail-load", onStop)
    }
  }, [])

  return (
    <div className="relative h-full w-full">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0d0d0d]">
          <Loader2 size={20} className="animate-spin text-white/20" />
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
