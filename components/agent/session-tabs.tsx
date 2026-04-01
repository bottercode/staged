"use client"

import { Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"

export type Session = {
  id: string
  name: string
  tag?: string | null
}

export function SessionTabs({
  sessions,
  currentSessionId,
  onSessionSelect,
  onNewSession,
  onSessionClose,
  onSessionRename,
  onSessionTag,
  onSessionFork,
}: {
  sessions: Session[]
  currentSessionId: string
  onSessionSelect: (id: string) => void
  onNewSession: () => void
  onSessionClose: (id: string) => void
  onSessionRename: (id: string) => void
  onSessionTag: (id: string) => void
  onSessionFork: (id: string) => void
}) {
  return (
    <div className="flex h-10 items-center gap-2 border-b bg-muted/20 px-4">
      {sessions.map((session) => (
        <div
          key={session.id}
          onClick={() => onSessionSelect(session.id)}
          className={cn(
            "flex h-full cursor-pointer items-center gap-2 border-b-2 px-3 text-sm font-medium",
            currentSessionId === session.id
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
          )}
        >
          <span>{session.name}</span>
          {session.tag && (
            <span className="rounded border px-1 py-0 text-[10px] text-muted-foreground">
              {session.tag}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="ml-1 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <MoreHorizontal className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onSessionRename(session.id)}>
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSessionTag(session.id)}>
                Tag
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSessionFork(session.id)}>
                Fork
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSessionClose(session.id)
            }}
            className="ml-1 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button
        onClick={onNewSession}
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}
