"use client"

import { MessageSquare, Calendar, User, Link2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export type TaskData = {
  id: string
  title: string
  description: string | null
  priority: string
  dueDate: Date | null
  assigneeId: string | null
  assigneeName: string | null
  assigneeAvatar: string | null
  channelMessageId?: string | null
  position: number
}

function formatDueShort(date: Date) {
  const d = new Date(date)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

  if (days < 0) return { text: `${Math.abs(days)}d`, overdue: true }
  if (days === 0) return { text: "Today", overdue: false }
  if (days === 1) return { text: "1d", overdue: false }
  return { text: `${days}d`, overdue: false }
}

export function TaskCard({
  task,
  onClick,
}: {
  task: TaskData
  onClick: () => void
}) {
  const due = task.dueDate ? formatDueShort(task.dueDate) : null

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-lg border bg-white px-3.5 pt-3 pb-3 shadow-sm transition-shadow hover:shadow-md dark:bg-card"
    >
      <p className="text-sm leading-snug">{task.title}</p>

      <div className="mt-3 flex items-center gap-3 text-muted-foreground">
        {task.description && <MessageSquare className="h-4 w-4" />}

        {task.channelMessageId && <Link2 className="h-4 w-4 text-primary" />}

        <Calendar className="h-4 w-4" />

        <User className="h-4 w-4" />

        {due && (
          <span
            className={cn("ml-auto text-xs", due.overdue && "text-red-500")}
          >
            {due.text}
          </span>
        )}
      </div>
    </div>
  )
}
