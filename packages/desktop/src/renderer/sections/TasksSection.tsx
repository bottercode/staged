import { CheckSquare, ExternalLink } from "lucide-react"

export function TasksSection() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04]">
          <CheckSquare size={24} className="text-white/40" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-[15px] font-semibold text-white/80">Tasks</h2>
          <p className="text-[13px] text-white/35">
            Kanban boards are available in the web app.
          </p>
        </div>
        <a
          href="https://staged-qfza.onrender.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border border-white/[0.08] px-4 py-2 text-[13px] text-white/50 transition-colors hover:border-white/20 hover:text-white/70"
        >
          Open web app
          <ExternalLink size={13} />
        </a>
      </div>
    </div>
  )
}
