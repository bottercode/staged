"use client"

import { useMemo, useState } from "react"
import { CalendarDays, Flag, Link2, UserRound } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { trpc } from "@/lib/trpc/client"
import { useCurrentUser } from "@/lib/user-context"
import { cn } from "@/lib/utils"

export type Attachment = {
  url: string
  name: string
  size: number
  contentType: string
}

export type TaskData = {
  id: string
  boardId: string
  columnName?: string | null
  title: string
  description: string | null
  priority: string
  dueDate: Date | null
  assigneeId: string | null
  assigneeName: string | null
  assigneeAvatar: string | null
  channelMessageId?: string | null
  labels?: string[]
  attachments?: Attachment[]
  position: number
  createdById?: string
  createdAt?: Date
}

const PRIORITY_META: Record<
  "urgent" | "high" | "medium" | "low",
  { label: string; chip: string; icon: string }
> = {
  urgent: {
    label: "P1",
    chip: "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300",
    icon: "text-rose-500",
  },
  high: {
    label: "P2",
    chip: "bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-300",
    icon: "text-orange-500",
  },
  medium: {
    label: "P3",
    chip: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300",
    icon: "text-amber-500",
  },
  low: {
    label: "P4",
    chip: "bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-300",
    icon: "text-pink-500",
  },
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
  boardId,
  onClick,
}: {
  task: TaskData
  boardId: string
  onClick: () => void
}) {
  const [memberQuery, setMemberQuery] = useState("")
  const [duePickerOpen, setDuePickerOpen] = useState(false)
  const [priorityPickerOpen, setPriorityPickerOpen] = useState(false)
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false)
  const { users } = useCurrentUser()
  const utils = trpc.useUtils()

  const updateTask = trpc.task.update.useMutation({
    onSuccess: () => {
      utils.board.getById.invalidate({ id: boardId })
    },
  })

  const setPriority = (priority: "urgent" | "high" | "medium" | "low") => {
    updateTask.mutate({ id: task.id, priority })
    setPriorityPickerOpen(false)
  }

  const setAssignee = (assigneeId: string | null) => {
    updateTask.mutate({ id: task.id, assigneeId })
    setAssigneePickerOpen(false)
    setMemberQuery("")
  }

  const setDueDate = (date: Date | null) => {
    updateTask.mutate({
      id: task.id,
      dueDate: date ? date.toISOString() : null,
    })
    setDuePickerOpen(false)
  }

  const due = task.dueDate ? formatDueShort(task.dueDate) : null
  const assigneeInitial =
    task.assigneeName?.trim().charAt(0).toUpperCase() || "U"
  const currentPriority =
    (task.priority as "urgent" | "high" | "medium" | "low") ?? "medium"
  const dueValue = task.dueDate
    ? new Date(task.dueDate).toISOString().slice(0, 10)
    : ""
  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase()
    if (!q) return users
    return users.filter((user) =>
      [user.name, user.email].some((value) => value?.toLowerCase().includes(q))
    )
  }, [memberQuery, users])

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-lg border bg-white px-3.5 pt-3 pb-3 shadow-sm transition-shadow hover:shadow-md dark:bg-card"
    >
      <p className="text-sm leading-snug">{task.title}</p>

      <div className="mt-3 flex items-center gap-1.5 text-muted-foreground">
        <Popover open={priorityPickerOpen} onOpenChange={setPriorityPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md border border-transparent hover:bg-muted",
                PRIORITY_META[currentPriority].icon
              )}
              title="Set priority"
            >
              <Flag className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="start"
            className="w-auto p-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1">
              {(["urgent", "high", "medium", "low"] as const).map(
                (priority) => (
                  <button
                    key={priority}
                    type="button"
                    onClick={() => setPriority(priority)}
                    className={cn(
                      "rounded-md px-2 py-1 text-xs font-semibold transition-colors",
                      PRIORITY_META[priority].chip,
                      currentPriority === priority
                        ? "ring-1 ring-foreground/20"
                        : ""
                    )}
                  >
                    {PRIORITY_META[priority].label}
                  </button>
                )
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={duePickerOpen} onOpenChange={setDuePickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md border border-transparent hover:bg-muted",
                due ? "text-foreground" : "text-muted-foreground"
              )}
              title="Set due date"
            >
              <CalendarDays className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="start"
            className="w-64 p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <Input
              type="date"
              value={dueValue}
              onChange={(e) => {
                const value = e.target.value
                setDueDate(value ? new Date(`${value}T00:00:00`) : null)
              }}
            />
            <div className="mt-2 flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setDueDate(new Date())}
                className="rounded px-2 py-1 hover:bg-muted"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() =>
                  setDueDate(new Date(Date.now() + 24 * 60 * 60 * 1000))
                }
                className="rounded px-2 py-1 hover:bg-muted"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() =>
                  setDueDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
                }
                className="rounded px-2 py-1 hover:bg-muted"
              >
                +1 week
              </button>
              <button
                type="button"
                onClick={() => setDueDate(null)}
                className="ml-auto rounded px-2 py-1 text-destructive hover:bg-muted"
              >
                Clear
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={assigneePickerOpen} onOpenChange={setAssigneePickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md border border-transparent hover:bg-muted",
                task.assigneeId ? "text-foreground" : "text-muted-foreground"
              )}
              title="Assign member"
            >
              <UserRound className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="start"
            className="w-72 p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Input
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              placeholder="Search members..."
            />
            <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
              <button
                type="button"
                onClick={() => setAssignee(null)}
                className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                Unassigned
              </button>
              {filteredMembers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setAssignee(user.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted",
                    task.assigneeId === user.id ? "bg-muted" : ""
                  )}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={user.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate text-sm">{user.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {due && (
          <span
            className={cn("ml-auto text-xs", due.overdue && "text-red-500")}
          >
            {due.text}
          </span>
        )}

        {!due && task.assigneeId ? (
          <div className="ml-auto">
            <Avatar className="h-5 w-5">
              <AvatarImage src={task.assigneeAvatar ?? undefined} />
              <AvatarFallback className="text-[9px]">
                {assigneeInitial}
              </AvatarFallback>
            </Avatar>
          </div>
        ) : null}

        {task.channelMessageId && (
          <Link2 className="h-3.5 w-3.5 text-primary" />
        )}
      </div>
    </div>
  )
}
