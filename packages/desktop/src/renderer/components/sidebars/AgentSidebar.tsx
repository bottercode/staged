import { FolderOpen, Plus, MessageSquare, X, ChevronLeft } from "lucide-react"
import type { AgentSession } from "../../App"

export function AgentSidebar({
  cwd,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onCloseSession,
  onCollapse,
}: {
  cwd: string | null
  sessions: AgentSession[]
  activeSessionId: string
  onSelectSession: (id: string) => void
  onNewSession: () => void
  onCloseSession: (id: string) => void
  onCollapse: () => void
}) {
  return (
    <div className="flex flex-col gap-1 p-2">
      {cwd && (
        <div className="mb-1 flex items-center gap-2 rounded-md px-2 py-1.5">
          <FolderOpen size={13} className="shrink-0 text-white/30" />
          <span className="truncate font-mono text-[11px] text-white/40">
            {cwd.split("/").pop()}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25">
          Chats
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onNewSession}
            className="rounded p-0.5 text-white/25 hover:bg-white/[0.06] hover:text-white/50 transition-colors"
            title="New chat"
          >
            <Plus size={13} />
          </button>
          <button
            onClick={onCollapse}
            className="rounded p-0.5 text-white/25 hover:bg-white/[0.06] hover:text-white/50 transition-colors"
            title="Collapse sidebar"
          >
            <ChevronLeft size={13} />
          </button>
        </div>
      </div>

      {sessions.map((s) => (
        <div
          key={s.id}
          className={`group flex w-full items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
            s.id === activeSessionId
              ? "bg-white/[0.08] text-white/90"
              : "text-white/40 hover:bg-white/[0.04] hover:text-white/60"
          }`}
        >
          <button
            onClick={() => onSelectSession(s.id)}
            className="flex flex-1 items-center gap-2 text-left min-w-0"
          >
            <MessageSquare size={13} className="shrink-0" />
            <span className="truncate text-[12px]">{s.name}</span>
          </button>
          {sessions.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); onCloseSession(s.id) }}
              className="shrink-0 opacity-0 group-hover:opacity-100 rounded p-0.5 transition-opacity hover:text-white/70"
              title="Close chat"
            >
              <X size={11} />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
