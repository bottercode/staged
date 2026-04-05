import { useState, useEffect } from "react"
import { NavRail } from "./components/NavRail"
import { Sidebar } from "./components/Sidebar"
import { SettingsModal } from "./components/SettingsModal"
import { AgentSection } from "./sections/AgentSection"
import { ChatSection } from "./sections/ChatSection"
import { TasksSection } from "./sections/TasksSection"
import { DocsSection } from "./sections/DocsSection"
import { PortalsSection } from "./sections/PortalsSection"

export type Section = "agent" | "chat" | "tasks" | "docs" | "portals"

export default function App() {
  const [section, setSection] = useState<Section>("agent")
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    window.api.getSettings().then((s) => {
      const keys = s.providerApiKeys as Record<string, string>
      const anyKey = Object.values(keys).some((v) => v?.trim())
      if (!anyKey) setSettingsOpen(true)
    })
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d0d0d] text-white">
      {/* Nav rail */}
      <NavRail
        active={section}
        onSelect={setSection}
        onSettings={() => setSettingsOpen(true)}
      />

      {/* Sidebar */}
      <Sidebar section={section} />

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Titlebar drag area */}
        <div
          className="titlebar-drag h-10 shrink-0 border-b border-white/[0.05]"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        />

        <div className="flex-1 overflow-hidden">
          {section === "agent" && <AgentSection />}
          {section === "chat" && <ChatSection />}
          {section === "tasks" && <TasksSection />}
          {section === "docs" && <DocsSection />}
          {section === "portals" && <PortalsSection />}
        </div>
      </main>

      {settingsOpen && (
        <SettingsModal onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  )
}
