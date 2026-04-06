import {
  MessageCircle,
  SquareKanban,
  BookOpen,
  Building2,
  Sparkles,
  Settings2,
} from "lucide-react"
import type { Section } from "../types"
import logo from "../assets/logo.png"

type NavItem = { id: Section; icon: React.ReactNode; label: string }

const NAV_ITEMS: NavItem[] = [
  { id: "chat",    icon: <MessageCircle className="h-[18px] w-[18px]" />, label: "Chat" },
  { id: "tasks",   icon: <SquareKanban  className="h-[18px] w-[18px]" />, label: "Tasks" },
  { id: "docs",    icon: <BookOpen      className="h-[18px] w-[18px]" />, label: "Docs" },
  { id: "portals", icon: <Building2     className="h-[18px] w-[18px]" />, label: "Client Portals" },
  { id: "agent",   icon: <Sparkles      className="h-[18px] w-[18px]" />, label: "AI Agent" },
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
    <aside className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-white/[0.05] bg-[#0a0a0a] py-3">
      {/* macOS traffic-light spacer */}
      <div
        className="titlebar-drag flex w-full items-center justify-center"
        style={{ height: isMac ? 28 : 0 }}
      />

      {/* Workspace / brand button */}
      <button
        title="Staged"
        className="mb-1 titlebar-no-drag transition-opacity hover:opacity-80"
      >
        <img src={logo} alt="Staged" className="h-8 w-8 rounded-lg" />
      </button>

      {/* Divider */}
      <div className="mb-1 h-px w-6 bg-white/[0.08]" />

      {/* Nav icons */}
      <nav className="flex flex-1 flex-col items-center gap-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            title={item.label}
            className={`titlebar-no-drag flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
              active === item.id
                ? "bg-white/90 text-black"
                : "text-white/40 hover:bg-white/[0.08] hover:text-white/80"
            }`}
          >
            {item.icon}
          </button>
        ))}
      </nav>

      {/* Settings */}
      <button
        onClick={onSettings}
        title="Agent Settings"
        className="titlebar-no-drag flex h-9 w-9 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/[0.08] hover:text-white/60"
      >
        <Settings2 className="h-[18px] w-[18px]" />
      </button>
    </aside>
  )
}
