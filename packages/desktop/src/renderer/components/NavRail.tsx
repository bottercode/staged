import {
  Sparkles,
  MessageSquare,
  CheckSquare,
  FileText,
  Globe,
  Settings,
} from "lucide-react"
import type { Section } from "../types"

type NavItem = { id: Section; icon: React.ReactNode; label: string }

const NAV_ITEMS: NavItem[] = [
  { id: "agent",   icon: <Sparkles size={18} />,       label: "Agent" },
  { id: "chat",    icon: <MessageSquare size={18} />,   label: "Chat" },
  { id: "tasks",   icon: <CheckSquare size={18} />,     label: "Tasks" },
  { id: "docs",    icon: <FileText size={18} />,        label: "Docs" },
  { id: "portals", icon: <Globe size={18} />,           label: "Portals" },
]

export function NavRail({
  active,
  onSelect,
  onSettings,
}: {
  active: Section
  onSelect: (s: Section) => void
  onSettings: () => void
}) {
  const isMac = window.api.platform === "darwin"

  return (
    <aside className="flex w-14 shrink-0 flex-col items-center border-r border-white/[0.05] bg-[#0a0a0a] py-2">
      {/* macOS traffic-light spacer */}
      <div
        className="titlebar-drag mb-1 flex w-full items-center justify-center"
        style={{ height: isMac ? 40 : 28 }}
      >
        {!isMac && (
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.06]">
            <Sparkles size={12} className="text-white/50" />
          </div>
        )}
      </div>

      {/* Nav icons */}
      <nav className="flex flex-1 flex-col items-center gap-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            title={item.label}
            className={`titlebar-no-drag relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
              active === item.id
                ? "bg-white/10 text-white"
                : "text-white/30 hover:bg-white/[0.06] hover:text-white/60"
            }`}
          >
            {item.icon}
            {active === item.id && (
              <span className="absolute left-0 h-5 w-0.5 rounded-r bg-white/50" />
            )}
          </button>
        ))}
      </nav>

      {/* Settings */}
      <button
        onClick={onSettings}
        title="Settings"
        className="titlebar-no-drag flex h-10 w-10 items-center justify-center rounded-xl text-white/25 transition-colors hover:bg-white/[0.06] hover:text-white/50"
      >
        <Settings size={15} />
      </button>
    </aside>
  )
}
