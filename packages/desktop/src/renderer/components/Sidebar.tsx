import type { Section } from "../App"
import { AgentSidebar } from "./sidebars/AgentSidebar"
import { PlaceholderSidebar } from "./sidebars/PlaceholderSidebar"

export function Sidebar({ section }: { section: Section }) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-white/[0.05] bg-[#0a0a0a]">
      {/* Title bar spacer on macOS */}
      <div
        className="titlebar-drag h-10 shrink-0"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />
      <div className="flex-1 overflow-y-auto">
        {section === "agent" && <AgentSidebar />}
        {section === "chat" && <PlaceholderSidebar label="Chat" />}
        {section === "tasks" && <PlaceholderSidebar label="Tasks" />}
        {section === "docs" && <PlaceholderSidebar label="Docs" />}
        {section === "portals" && <PlaceholderSidebar label="Portals" />}
      </div>
    </aside>
  )
}
