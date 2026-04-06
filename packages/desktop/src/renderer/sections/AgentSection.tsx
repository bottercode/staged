import type { AgentSession } from "../App"
import { FolderPicker } from "../components/FolderPicker"
import { ChatPanel } from "../components/ChatPanel"

export function AgentSection({
  cwd,
  setCwd,
  session,
  onHistoryUpdate,
  onGoToWorkspace,
}: {
  cwd: string | null
  setCwd: (path: string | null) => void
  session: AgentSession
  onHistoryUpdate: (id: string, history: unknown[]) => void
  onGoToWorkspace: () => void
}) {
  if (!cwd) {
    return <FolderPicker onSelect={setCwd} onGoToWorkspace={onGoToWorkspace} />
  }

  const handleSwitchRepo = async () => {
    const folder = await window.api.openFolder()
    if (folder) setCwd(folder)
  }

  return (
    <ChatPanel
      key={session.id}
      cwd={cwd}
      sessionId={session.id}
      history={session.history}
      onHistoryUpdate={(h) => onHistoryUpdate(session.id, h)}
      onDisconnect={() => setCwd(null)}
      onSwitchRepo={() => void handleSwitchRepo()}
    />
  )
}
