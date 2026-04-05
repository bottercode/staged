import { useAgentStore } from "../store/agentStore"
import { FolderPicker } from "../components/FolderPicker"
import { ChatPanel } from "../components/ChatPanel"

export function AgentSection() {
  const { cwd, setCwd, sessions, activeSessionId, updateSessionHistory } =
    useAgentStore()

  const activeSession = sessions.find((s) => s.id === activeSessionId)

  if (!cwd) {
    return <FolderPicker onSelect={setCwd} />
  }

  if (!activeSession) return null

  return (
    <ChatPanel
      key={activeSession.id}
      cwd={cwd}
      sessionId={activeSession.id}
      history={activeSession.history}
      onHistoryUpdate={(h) => updateSessionHistory(activeSession.id, h)}
    />
  )
}
