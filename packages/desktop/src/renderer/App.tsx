import { useState, useEffect } from "react"
import type { Section } from "./types"
import { NavRail } from "./components/NavRail"
import { AgentSidebar } from "./components/sidebars/AgentSidebar"
import { SettingsModal } from "./components/SettingsModal"
import { AgentSection } from "./sections/AgentSection"
import { ChatSection } from "./sections/ChatSection"
import { TasksSection } from "./sections/TasksSection"
import { DocsSection } from "./sections/DocsSection"
import { PortalsSection } from "./sections/PortalsSection"

const WEB_SECTIONS: Section[] = ["chat", "tasks", "docs", "portals"]

export default function App() {
  const [section, setSection] = useState<Section>("agent")
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    window.api.getSettings().then((s) => {
      const keys = s.providerApiKeys as Record<string, string>
      if (!Object.values(keys).some((v) => v?.trim())) setSettingsOpen(true)
    })
  }, [])

  const isWebSection = WEB_SECTIONS.includes(section)

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d0d0d] text-white">
      <NavRail
        active={section}
        onSelect={setSection}
        onSettings={() => setSettingsOpen(true)}
      />

      {/* Agent: native sidebar + local chat */}
      {section === "agent" && (
        <>
          <aside className="flex w-56 shrink-0 flex-col border-r border-white/[0.05] bg-[#0a0a0a]">
            <div className="titlebar-drag h-10 shrink-0" />
            <div className="flex-1 overflow-y-auto">
              <AgentSidebar />
            </div>
          </aside>
          <main className="flex flex-1 flex-col overflow-hidden">
            <div className="titlebar-drag h-10 shrink-0 border-b border-white/[0.05]" />
            <div className="flex-1 overflow-hidden">
              <AgentSection />
            </div>
          </main>
        </>
      )}

      {/* Web sections: webview fills full width */}
      {isWebSection && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="titlebar-drag h-10 shrink-0 border-b border-white/[0.05]" />
          <div className="flex-1 overflow-hidden">
            {section === "chat" && <ChatSection />}
            {section === "tasks" && <TasksSection />}
            {section === "docs" && <DocsSection />}
            {section === "portals" && <PortalsSection />}
          </div>
        </div>
      )}

      {settingsOpen && (
        <SettingsModal onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  )
}
