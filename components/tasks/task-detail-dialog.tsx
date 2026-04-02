"use client"

import { useMemo, useState } from "react"
import {
  CalendarDays,
  X,
  Flag,
  MoreHorizontal,
  SendHorizontal,
  Tag,
  Trash2,
  UserRound,
} from "lucide-react"
import { trpc } from "@/lib/trpc/client"
import { useCurrentUser } from "@/lib/user-context"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import type { TaskData } from "./task-card"

const PRIORITY_META: Record<
  "urgent" | "high" | "medium" | "low",
  { label: string; iconColor: string; chipColor: string }
> = {
  urgent: {
    label: "P1",
    iconColor: "text-rose-500",
    chipColor: "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300",
  },
  high: {
    label: "P2",
    iconColor: "text-orange-500",
    chipColor: "bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-300",
  },
  medium: {
    label: "P3",
    iconColor: "text-amber-500",
    chipColor: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300",
  },
  low: {
    label: "P4",
    iconColor: "text-pink-500",
    chipColor: "bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-300",
  },
}

function formatCreatedAt(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date))
}

function formatRelativeTime(date: Date) {
  const now = Date.now()
  const target = new Date(date).getTime()
  const diffSeconds = Math.max(1, Math.floor((now - target) / 1000))
  if (diffSeconds < 60) return "just now"
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

export function TaskDetailDialog({
  open,
  onOpenChange,
  task,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: TaskData
}) {
  const initialDueDate =
    task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ""
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? "")
  const [priority, setPriority] = useState(
    task.priority as "low" | "medium" | "high" | "urgent"
  )
  const [assigneeId, setAssigneeId] = useState(task.assigneeId ?? "")
  const [dueDate, setDueDate] = useState(initialDueDate)
  const [savedSnapshot, setSavedSnapshot] = useState(() => ({
    title: task.title,
    description: task.description ?? "",
    priority: task.priority as "low" | "medium" | "high" | "urgent",
    assigneeId: task.assigneeId ?? "",
    dueDate: initialDueDate,
    labelsKey: (task.labels ?? []).join("\u0001"),
  }))
  const [memberQuery, setMemberQuery] = useState("")
  const [labelDraft, setLabelDraft] = useState("")
  const [commentDraft, setCommentDraft] = useState("")
  const [priorityOpen, setPriorityOpen] = useState(false)
  const [dueOpen, setDueOpen] = useState(false)
  const [assigneeOpen, setAssigneeOpen] = useState(false)
  const [labelOpen, setLabelOpen] = useState(false)
  const [labels, setLabels] = useState<string[]>(task.labels ?? [])
  const { currentUser, users } = useCurrentUser()
  const utils = trpc.useUtils()

  const comments = trpc.task.comments.useQuery(
    { taskId: task.id },
    { enabled: open }
  )

  const updateTask = trpc.task.update.useMutation({
    onSuccess: () => {
      utils.board.getById.invalidate({ id: task.boardId })
    },
  })

  const deleteTask = trpc.task.delete.useMutation({
    onSuccess: () => {
      utils.board.getById.invalidate({ id: task.boardId })
      onOpenChange(false)
    },
  })

  const addComment = trpc.task.addComment.useMutation({
    onSuccess: () => {
      utils.task.comments.invalidate({ taskId: task.id })
      setCommentDraft("")
    },
  })

  const deleteComment = trpc.task.deleteComment.useMutation({
    onSuccess: () => {
      utils.task.comments.invalidate({ taskId: task.id })
    },
  })

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase()
    if (!q) return users
    return users.filter((user) =>
      [user.name, user.email].some((value) =>
        value?.toLowerCase().includes(q)
      )
    )
  }, [memberQuery, users])

  const selectedAssignee = users.find((user) => user.id === assigneeId)
  const creator = users.find((user) => user.id === task.createdById)
  const currentPriority = PRIORITY_META[priority]
  const hasUnsavedChanges =
    title.trim() !== savedSnapshot.title ||
    (description.trim() || "") !== savedSnapshot.description ||
    priority !== savedSnapshot.priority ||
    assigneeId !== savedSnapshot.assigneeId ||
    dueDate !== savedSnapshot.dueDate ||
    labels.join("\u0001") !== savedSnapshot.labelsKey

  const suggestedLabels = ["bug", "backend", "frontend", "urgent", "design"]

  const addLabel = (raw: string) => {
    const next = raw.trim().toLowerCase()
    if (!next) return
    if (labels.includes(next)) return
    if (labels.length >= 12) return
    setLabels((prev) => [...prev, next])
    setLabelDraft("")
  }

  const removeLabel = (label: string) => {
    setLabels((prev) => prev.filter((item) => item !== label))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        key={task.id}
        className="flex h-[90vh] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:h-[88vh] sm:w-[calc(100vw-4rem)] sm:max-w-[calc(100vw-4rem)] xl:max-w-[1460px]"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title || "Task details"}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="w-full px-5 pt-6 pb-6 sm:px-7 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span>{task.columnName ?? "Task"}</span>
              </div>
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="cursor-pointer text-destructive focus:text-destructive"
                      onClick={() => deleteTask.mutate({ id: task.id })}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <Textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className="mt-3 min-h-[56px] resize-none border-0 px-0 text-4xl leading-tight font-semibold shadow-none focus-visible:ring-0"
            />

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted">
                    <Flag className={cn("h-4 w-4", currentPriority.iconColor)} />
                    {currentPriority.label}
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" className="w-auto p-1">
                  <div className="flex items-center gap-1">
                    {(["urgent", "high", "medium", "low"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setPriority(value)
                          setPriorityOpen(false)
                        }}
                        className={cn(
                          "rounded-md px-2 py-1 text-xs font-semibold",
                          PRIORITY_META[value].chipColor,
                          priority === value ? "ring-1 ring-foreground/20" : ""
                        )}
                      >
                        {PRIORITY_META[value].label}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <Popover open={dueOpen} onOpenChange={setDueOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted">
                    <CalendarDays className="h-4 w-4" />
                    {dueDate
                      ? new Date(`${dueDate}T00:00:00`).toLocaleDateString()
                      : "No due date"}
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" className="w-64 p-3">
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => {
                      setDueDate(e.target.value)
                      setDueOpen(false)
                    }}
                  />
                  <div className="mt-2 flex items-center gap-1 text-xs">
                    <button
                      type="button"
                      className="rounded px-2 py-1 hover:bg-muted"
                      onClick={() => {
                        setDueDate(new Date().toISOString().slice(0, 10))
                        setDueOpen(false)
                      }}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      className="rounded px-2 py-1 hover:bg-muted"
                      onClick={() => {
                        setDueDate(
                          new Date(Date.now() + 24 * 60 * 60 * 1000)
                            .toISOString()
                            .slice(0, 10)
                        )
                        setDueOpen(false)
                      }}
                    >
                      Tomorrow
                    </button>
                    <button
                      type="button"
                      className="rounded px-2 py-1 hover:bg-muted"
                      onClick={() => {
                        setDueDate(
                          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                            .toISOString()
                            .slice(0, 10)
                        )
                        setDueOpen(false)
                      }}
                    >
                      +1 week
                    </button>
                    <button
                      type="button"
                      className="ml-auto rounded px-2 py-1 text-destructive hover:bg-muted"
                      onClick={() => {
                        setDueDate("")
                        setDueOpen(false)
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </PopoverContent>
              </Popover>

              <Popover open={labelOpen} onOpenChange={setLabelOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
                  >
                    <Tag className="h-4 w-4" />
                    {labels.length > 0 ? `${labels.length} labels` : "Add label"}
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" className="w-72 p-2">
                  <Input
                    value={labelDraft}
                    onChange={(e) => setLabelDraft(e.target.value)}
                    placeholder="Add a label..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addLabel(labelDraft)
                      }
                    }}
                  />
                  <div className="mt-2 flex flex-wrap gap-1">
                    {suggestedLabels.map((label) => (
                      <button
                        key={label}
                        type="button"
                        className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                        onClick={() => addLabel(label)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {labels.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {labels.map((label) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => removeLabel(label)}
                          className="rounded-md bg-muted px-2 py-1 text-xs"
                          title="Click to remove"
                        >
                          {label} ×
                        </button>
                      ))}
                    </div>
                  ) : null}
                </PopoverContent>
              </Popover>

              <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted">
                    <UserRound className="h-4 w-4" />
                    {selectedAssignee?.name ?? "No assignees"}
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" className="w-72 p-2">
                  <Input
                    value={memberQuery}
                    onChange={(e) => setMemberQuery(e.target.value)}
                    placeholder="Search members..."
                  />
                  <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setAssigneeId("")
                        setAssigneeOpen(false)
                      }}
                      className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      Unassigned
                    </button>
                    {filteredMembers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setAssigneeId(user.id)
                          setAssigneeOpen(false)
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted",
                          user.id === assigneeId ? "bg-muted" : ""
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
            </div>

            <Separator className="my-4" />

            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Description
              </p>
              {labels.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-1">
                  {labels.map((label) => (
                    <span
                      key={label}
                      className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              ) : null}
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Write more details about this task..."
                className="min-h-[220px] resize-y text-base"
              />
            </div>

            <Separator className="my-5" />

            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Comments ({comments.data?.length ?? 0})
              </p>

              <div className="mt-3 space-y-3">
                {comments.error ? (
                  <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    Could not load comments. Please refresh and try again.
                  </p>
                ) : null}
                {(comments.data ?? []).map((comment) => {
                  const isMine = currentUser?.id === comment.userId
                  const fallback =
                    comment.userName?.trim().charAt(0).toUpperCase() || "U"
                  return (
                    <div key={comment.id} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={comment.userAvatarUrl ?? undefined} />
                            <AvatarFallback className="text-[10px]">
                              {fallback}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium">{comment.userName}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatRelativeTime(comment.createdAt)}
                              </span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-sm">
                              {comment.content}
                            </p>
                          </div>
                        </div>
                        {isMine ? (
                          <button
                            type="button"
                            className="text-xs text-destructive hover:underline"
                            onClick={() => deleteComment.mutate({ id: comment.id })}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )
                })}

                <div className="rounded-md border p-2">
                  <div className="flex items-end gap-2">
                    <Textarea
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      placeholder="Write a comment..."
                      className="min-h-[84px] resize-none border-0 px-2 py-1 shadow-none focus-visible:ring-0"
                    />
                    <Button
                      size="sm"
                      disabled={!commentDraft.trim() || addComment.isPending}
                      onClick={() =>
                        addComment.mutate({
                          taskId: task.id,
                          content: commentDraft.trim(),
                        })
                      }
                    >
                      <SendHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                  {addComment.error ? (
                    <p className="px-2 pt-1 text-xs text-destructive">
                      Failed to post comment. Please try again.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t px-5 py-4 sm:px-7 lg:px-8">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Avatar className="h-6 w-6">
              <AvatarImage src={creator?.avatarUrl ?? undefined} />
              <AvatarFallback className="text-[10px]">
                {(creator?.name || "U")[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span>
              Created by{" "}
              <span className="font-medium text-foreground">
                {creator?.name || "Unknown"}
              </span>{" "}
              on {formatCreatedAt(task.createdAt ?? new Date())}
            </span>
          </div>
          {hasUnsavedChanges ? (
            <Button
              disabled={!title.trim() || updateTask.isPending}
              onClick={() => {
                const payload = {
                  id: task.id,
                  title: title.trim(),
                  description: description.trim() || null,
                  priority,
                  assigneeId: assigneeId || null,
                  dueDate: dueDate ? new Date(`${dueDate}T00:00:00`).toISOString() : null,
                  labels,
                } as const
                updateTask.mutate(payload, {
                  onSuccess: () => {
                    setSavedSnapshot({
                      title: payload.title,
                      description: payload.description ?? "",
                      priority: payload.priority,
                      assigneeId: payload.assigneeId ?? "",
                      dueDate,
                      labelsKey: labels.join("\u0001"),
                    })
                  },
                })
              }}
            >
              Save
            </Button>
          ) : (
            <div />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
