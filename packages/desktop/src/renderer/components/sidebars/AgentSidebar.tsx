import { FolderOpen, Plus, MessageSquare } from "lucide-react"
import { useAgentStore } from "../../store/agentStore"

export function AgentSidebar() {
  const { cwd, sessions, activeSessionId, setActiveSession, createSession } =
    useAgentStore()

  return (
    <div className="flex flex-col gap-1 p-2">
      {/* Folder */}
      {cwd && (
        <div className="mb-1 flex items-center gap-2 rounded-md px-2 py-1.5">
          <FolderOpen size={13} className="shrink-0 text-white/30" />
          <span className="truncate font-mono text-[11px] text-white/40">
            {cwd.split("/").pop()}
          </span>
        </div>
      )}

      {/* Section header */}
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25">
          Chats
        </span>
        <button
          onClick={createSession}
          className="rounded p-0.5 text-white/25 hover:bg-white/[0.06] hover:text-white/50 transition-colors"
          title="New chat"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Session list */}
      {sessions.map((s) => (
        <button
          key={s.id}
          onClick={() => setActiveSession(s.id)}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
            s.id === activeSessionId
              ? "bg-white/[0.08] text-white/90"
              : "text-white/40 hover:bg-white/[0.04] hover:text-white/60"
          }`}
        >
          <MessageSquare size={13} className="shrink-0" />
          <span className="truncate text-[12px]">{s.name}</span>
        </button>
      ))}
    </div>
  )
}
