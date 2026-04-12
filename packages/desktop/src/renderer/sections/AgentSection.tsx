import type { AgentSession } from "../App"
import { FolderPicker } from "../components/FolderPicker"
import { ChatPanel, type Message } from "../components/ChatPanel"

export function AgentSection({
  cwd,
  setCwd,
  session,
  messages,
  setMessages,
  onHistoryUpdate,
}: {
  cwd: string | null
  setCwd: (path: string | null) => void
  session: AgentSession
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  onHistoryUpdate: (id: string, history: unknown[]) => void
}) {
  if (!cwd) {
    return <FolderPicker onSelect={setCwd} />
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
      messages={messages}
      setMessages={setMessages}
      onHistoryUpdate={(h) => onHistoryUpdate(session.id, h)}
      onDisconnect={() => setCwd(null)}
      onSwitchRepo={() => void handleSwitchRepo()}
    />
  )
}
