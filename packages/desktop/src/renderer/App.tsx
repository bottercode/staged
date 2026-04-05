import { useState, useEffect } from "react"
import { FolderPicker } from "./components/FolderPicker"
import { ChatPanel } from "./components/ChatPanel"
import { SettingsModal } from "./components/SettingsModal"

export default function App() {
  const [cwd, setCwd] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)

  useEffect(() => {
    window.api.getSettings().then((s) => {
      const keys = s.providerApiKeys as Record<string, string>
      const anyKey = Object.values(keys).some((v) => v?.trim())
      setHasApiKey(anyKey)
      // Open settings if no API keys configured yet
      if (!anyKey) setSettingsOpen(true)
    })
  }, [])

  return (
    <div className="flex h-screen flex-col bg-[#0a0a0a] text-white overflow-hidden">
      {/* Title bar */}
      <div
        className="titlebar-drag flex h-10 shrink-0 items-center justify-between px-4 border-b border-white/[0.06]"
        style={{ paddingLeft: process.platform === "darwin" ? 80 : 16 }}
      >
        <span className="text-[13px] font-semibold text-white/70 titlebar-no-drag select-none">
          {cwd ? cwd.split("/").pop() : "Staged"}
        </span>
        <div className="titlebar-no-drag flex items-center gap-2">
          {cwd && (
            <button
              onClick={() => setCwd(null)}
              className="rounded px-2 py-1 text-[11px] text-white/40 hover:bg-white/[0.06] hover:text-white/70 transition-colors"
            >
              Change folder
            </button>
          )}
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded p-1.5 text-white/40 hover:bg-white/[0.06] hover:text-white/70 transition-colors"
            title="Settings"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        {!cwd ? (
          <FolderPicker onSelect={setCwd} />
        ) : (
          <ChatPanel cwd={cwd} />
        )}
      </div>

      {settingsOpen && (
        <SettingsModal
          onClose={() => {
            setSettingsOpen(false)
            window.api.getSettings().then((s) => {
              const keys = s.providerApiKeys as Record<string, string>
              setHasApiKey(Object.values(keys).some((v) => v?.trim()))
            })
          }}
        />
      )}
    </div>
  )
}
