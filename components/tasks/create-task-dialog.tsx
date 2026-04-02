"use client"

import { useMemo, useState } from "react"
import { CalendarDays, Flag, Tag, UserRound, X } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

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

export function CreateTaskDialog({
  open,
  onOpenChange,
  boardId,
  columnId,
  columnName,
  workspaceId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  boardId: string
  columnId: string
  columnName: string
  workspaceId: string
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">(
    "medium"
  )
  const [assigneeId, setAssigneeId] = useState<string>("")
  const [dueDate, setDueDate] = useState("")
  const [memberQuery, setMemberQuery] = useState("")
  const [labelDraft, setLabelDraft] = useState("")
  const [labels, setLabels] = useState<string[]>([])
  const [priorityOpen, setPriorityOpen] = useState(false)
  const [dueOpen, setDueOpen] = useState(false)
  const [assigneeOpen, setAssigneeOpen] = useState(false)
  const [labelOpen, setLabelOpen] = useState(false)
  const { currentUser, users } = useCurrentUser()
  const utils = trpc.useUtils()

  const createTask = trpc.task.create.useMutation({
    onSuccess: () => {
      utils.board.getById.invalidate({ id: boardId })
      onOpenChange(false)
      setTitle("")
      setDescription("")
      setPriority("medium")
      setAssigneeId("")
      setDueDate("")
      setMemberQuery("")
      setLabelDraft("")
      setLabels([])
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
  const currentPriority = PRIORITY_META[priority]
  const suggestedLabels = ["bug", "backend", "frontend", "urgent", "design"]

  const addLabel = (raw: string) => {
    const next = raw.trim().toLowerCase()
    if (!next || labels.includes(next)) return
    setLabels((prev) => [...prev, next])
    setLabelDraft("")
  }

  const removeLabel = (label: string) => {
    setLabels((prev) => prev.filter((item) => item !== label))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[90vh] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:h-[88vh] sm:w-[calc(100vw-4rem)] sm:max-w-[calc(100vw-4rem)] xl:max-w-[1460px]"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Create task</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="w-full px-5 pt-6 pb-6 sm:px-7 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span>{columnName}</span>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
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
                          PRIORITY_META[value].chipColor
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
                </PopoverContent>
              </Popover>

              <Popover open={labelOpen} onOpenChange={setLabelOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted">
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
                Comments (0)
              </p>
              <div className="mt-3 rounded-md border p-2">
                <Textarea
                  disabled
                  placeholder="Create the task first to add comments..."
                  className="min-h-[84px] resize-none border-0 px-2 py-1 text-sm shadow-none focus-visible:ring-0"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t px-5 py-4 sm:px-7 lg:px-8">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Avatar className="h-6 w-6">
              <AvatarImage src={currentUser?.avatarUrl ?? undefined} />
              <AvatarFallback className="text-[10px]">
                {currentUser?.name?.charAt(0).toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
            <span>
              Will be created by{" "}
              <span className="font-medium text-foreground">
                {currentUser?.name ?? "you"}
              </span>
            </span>
          </div>
          <Button
            disabled={!title.trim() || createTask.isPending || !currentUser}
            onClick={() => {
              if (!currentUser) return
              createTask.mutate({
                boardId,
                columnId,
                workspaceId,
                title: title.trim(),
                description: description.trim() || undefined,
                priority,
                assigneeId: assigneeId || undefined,
                dueDate: dueDate
                  ? new Date(`${dueDate}T00:00:00`).toISOString()
                  : undefined,
                labels,
                createdById: currentUser.id,
              })
            }}
          >
            Create Task
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
