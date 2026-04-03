"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import {
  CalendarDays,
  Check,
  Filter,
  Flag,
  LayoutGrid,
  List,
  Plus,
  Tag,
  UserRound,
} from "lucide-react"
import { trpc } from "@/lib/trpc/client"
import { BoardView } from "@/components/tasks/board-view"
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog"
import { TaskDetailDialog } from "@/components/tasks/task-detail-dialog"
import type { TaskData } from "@/components/tasks/task-card"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

type ViewMode = "board" | "list"
type TaskFilters = {
  assigneeIds: string[]
  priorities: Array<"urgent" | "high" | "medium" | "low">
  labels: string[]
  statuses: string[]
}

const EMPTY_FILTERS: TaskFilters = {
  assigneeIds: [],
  priorities: [],
  labels: [],
  statuses: [],
}

function moveTaskInColumns(params: {
  columns: Array<{
    id: string
    name: string
    position: number
    tasks: TaskData[]
  }>
  taskId: string
  sourceColumnId: string
  destinationColumnId: string
  destinationIndex: number
}): Array<{
  id: string
  name: string
  position: number
  tasks: TaskData[]
}> {
  const {
    columns,
    taskId,
    sourceColumnId,
    destinationColumnId,
    destinationIndex,
  } = params
  const next = columns.map((column) => ({
    ...column,
    tasks: [...column.tasks],
  }))
  const sourceColumn = next.find((column) => column.id === sourceColumnId)
  const destinationColumn = next.find(
    (column) => column.id === destinationColumnId
  )
  if (!sourceColumn || !destinationColumn) return columns

  const idx = sourceColumn.tasks.findIndex((task) => task.id === taskId)
  if (idx === -1) return columns
  const [task] = sourceColumn.tasks.splice(idx, 1)
  destinationColumn.tasks.splice(
    Math.max(0, Math.min(destinationIndex, destinationColumn.tasks.length)),
    0,
    task
  )
  return next
}

export default function BoardPage() {
  const params = useParams<{ boardId: string }>()
  const boardId = params?.boardId ?? ""
  const [viewMode, setViewMode] = useState<ViewMode>("board")
  const [createInColumn, setCreateInColumn] = useState<{
    id: string
    name: string
  } | null>(null)
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null)
  const [labelDraftByTask, setLabelDraftByTask] = useState<
    Record<string, string>
  >({})
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS)
  const [pendingFilters, setPendingFilters] =
    useState<TaskFilters>(EMPTY_FILTERS)
  const { data: board } = trpc.board.getById.useQuery({
    id: boardId,
  })
  const { data: users = [] } = trpc.user.list.useQuery()
  const utils = trpc.useUtils()
  const updateTask = trpc.task.update.useMutation({
    onSuccess: () => utils.board.getById.invalidate({ id: boardId }),
  })
  const moveTask = trpc.task.move.useMutation({
    onSuccess: () => utils.board.getById.invalidate({ id: boardId }),
  })

  if (!board) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading board...</div>
      </div>
    )
  }

  const listRows = board.columns.flatMap((column) =>
    column.tasks.map((task) => ({
      ...task,
      statusName: column.name,
      statusColumnId: column.id,
    }))
  )
  const normalizedLabels = new Set<string>()
  const seedLabels = ["bug", "backend", "frontend", "urgent", "design"]
  for (const label of seedLabels) normalizedLabels.add(label)
  for (const label of filters.labels) normalizedLabels.add(label)
  for (const label of pendingFilters.labels) normalizedLabels.add(label)
  for (const task of listRows) {
    for (const label of task.labels ?? []) {
      const value = label.trim().toLowerCase()
      if (value) normalizedLabels.add(value)
    }
  }
  const allLabels = Array.from(normalizedLabels).sort()

  const matchesFilters = (task: (typeof listRows)[number]) => {
    if (
      filters.assigneeIds.length > 0 &&
      (!task.assigneeId || !filters.assigneeIds.includes(task.assigneeId))
    ) {
      return false
    }
    if (
      filters.priorities.length > 0 &&
      !filters.priorities.includes(
        task.priority as "urgent" | "high" | "medium" | "low"
      )
    ) {
      return false
    }
    if (
      filters.labels.length > 0 &&
      !filters.labels.some((label) => (task.labels ?? []).includes(label))
    ) {
      return false
    }
    if (
      filters.statuses.length > 0 &&
      !filters.statuses.includes(task.statusName)
    ) {
      return false
    }
    return true
  }

  const filteredRows = listRows.filter(matchesFilters)
  const filteredColumns = board.columns.map((column) => ({
    ...column,
    tasks: column.tasks.filter((task) =>
      filteredRows.some((filteredTask) => filteredTask.id === task.id)
    ),
  }))

  const optimisticTaskUpdate = (
    taskId: string,
    patch: Partial<TaskData>,
    input: {
      assigneeId?: string | null
      dueDate?: string | null
      priority?: "urgent" | "high" | "medium" | "low"
      labels?: string[]
    }
  ) => {
    const queryInput = { id: boardId }
    const previous = utils.board.getById.getData(queryInput)
    utils.board.getById.setData(queryInput, (current) => {
      if (!current) return current
      return {
        ...current,
        columns: current.columns.map((column) => ({
          ...column,
          tasks: column.tasks.map((task) =>
            task.id === taskId ? { ...task, ...patch } : task
          ),
        })),
      }
    })

    updateTask.mutate(
      {
        id: taskId,
        ...input,
      },
      {
        onError: () => {
          utils.board.getById.setData(queryInput, previous)
        },
        onSettled: () => {
          utils.board.getById.invalidate(queryInput)
        },
      }
    )
  }

  const optimisticTaskMove = (params: {
    taskId: string
    sourceColumnId: string
    destinationColumnId: string
    destinationIndex: number
  }) => {
    const { taskId, sourceColumnId, destinationColumnId, destinationIndex } =
      params
    const queryInput = { id: boardId }
    const previous = utils.board.getById.getData(queryInput)
    utils.board.getById.setData(queryInput, (current) => {
      if (!current) return current
      const newColumns = moveTaskInColumns({
        columns: current.columns as Array<{
          id: string
          name: string
          position: number
          tasks: TaskData[]
        }>,
        taskId,
        sourceColumnId,
        destinationColumnId,
        destinationIndex,
      })
      return {
        ...current,
        columns: newColumns as typeof current.columns,
      }
    })

    moveTask.mutate(
      {
        id: taskId,
        columnId: destinationColumnId,
        position: destinationIndex,
      },
      {
        onError: () => {
          utils.board.getById.setData(queryInput, previous)
        },
        onSettled: () => {
          utils.board.getById.invalidate(queryInput)
        },
      }
    )
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Board header */}
      <div className="flex h-12 items-center gap-2 border-b px-4">
        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">{board.name}</span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <Popover
          open={filterOpen}
          onOpenChange={(open) => {
            setFilterOpen(open)
            if (open) setPendingFilters(filters)
          }}
        >
          <PopoverTrigger asChild>
            <button className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
              <Filter className="h-3.5 w-3.5" />
              Filter
              {[
                pendingFilters.assigneeIds.length,
                pendingFilters.priorities.length,
                pendingFilters.labels.length,
                pendingFilters.statuses.length,
              ].reduce((sum, value) => sum + value, 0) > 0 ? (
                <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                  {[
                    filters.assigneeIds.length,
                    filters.priorities.length,
                    filters.labels.length,
                    filters.statuses.length,
                  ].reduce((sum, value) => sum + value, 0)}
                </span>
              ) : null}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[340px] p-4">
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-sm font-medium">Assignee</p>
                <div className="flex flex-wrap gap-2">
                  {users.map((user) => {
                    const active = pendingFilters.assigneeIds.includes(user.id)
                    return (
                      <button
                        key={user.id}
                        type="button"
                        className={cn(
                          "rounded-full p-0.5 ring-2 ring-transparent",
                          active
                            ? "ring-primary"
                            : "hover:ring-muted-foreground/40"
                        )}
                        onClick={() =>
                          setPendingFilters((prev) => ({
                            ...prev,
                            assigneeIds: active
                              ? prev.assigneeIds.filter((id) => id !== user.id)
                              : [...prev.assigneeIds, user.id],
                          }))
                        }
                        title={user.name}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-[10px]">
                            {user.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Priority</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "urgent", label: "P1" },
                    { key: "high", label: "P2" },
                    { key: "medium", label: "P3" },
                    { key: "low", label: "P4" },
                  ].map((option) => {
                    const active = pendingFilters.priorities.includes(
                      option.key as "urgent" | "high" | "medium" | "low"
                    )
                    return (
                      <button
                        key={option.key}
                        type="button"
                        className={cn(
                          "rounded-md border px-3 py-1 text-sm",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "hover:bg-muted"
                        )}
                        onClick={() =>
                          setPendingFilters((prev) => ({
                            ...prev,
                            priorities: active
                              ? prev.priorities.filter((p) => p !== option.key)
                              : [
                                  ...prev.priorities,
                                  option.key as
                                    | "urgent"
                                    | "high"
                                    | "medium"
                                    | "low",
                                ],
                          }))
                        }
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Labels</p>
                <div className="flex flex-wrap gap-2">
                  {allLabels.length === 0 ? (
                    <span className="text-sm text-muted-foreground">
                      No labels found
                    </span>
                  ) : (
                    allLabels.map((label) => {
                      const active = pendingFilters.labels.includes(label)
                      return (
                        <button
                          key={label}
                          type="button"
                          className={cn(
                            "rounded-md border px-3 py-1 text-sm",
                            active
                              ? "border-primary bg-primary/10 text-primary"
                              : "hover:bg-muted"
                          )}
                          onClick={() =>
                            setPendingFilters((prev) => ({
                              ...prev,
                              labels: active
                                ? prev.labels.filter((item) => item !== label)
                                : [...prev.labels, label],
                            }))
                          }
                        >
                          {label}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Status</p>
                <div className="flex flex-wrap gap-2">
                  {board.columns.map((column) => {
                    const active = pendingFilters.statuses.includes(column.name)
                    return (
                      <button
                        key={column.id}
                        type="button"
                        className={cn(
                          "rounded-md border px-3 py-1 text-sm",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "hover:bg-muted"
                        )}
                        onClick={() =>
                          setPendingFilters((prev) => ({
                            ...prev,
                            statuses: active
                              ? prev.statuses.filter((s) => s !== column.name)
                              : [...prev.statuses, column.name],
                          }))
                        }
                      >
                        {column.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-3">
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => setPendingFilters(EMPTY_FILTERS)}
                >
                  Clear all
                </button>
                <Button
                  size="sm"
                  onClick={() => {
                    setFilters(pendingFilters)
                    setFilterOpen(false)
                  }}
                >
                  Done
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex items-center rounded-md border bg-muted/40 p-0.5">
          <button
            onClick={() => setViewMode("board")}
            className={cn(
              "rounded-sm p-1.5 transition-colors",
              viewMode === "board"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "rounded-sm p-1.5 transition-colors",
              viewMode === "list"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {viewMode === "board" ? (
        <BoardView
          boardId={board.id}
          workspaceId={board.workspaceId}
          columns={filteredColumns}
        />
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="border-b bg-muted/20 text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Assignees</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Labels</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b text-muted-foreground">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => {
                      const first = board.columns[0]
                      if (!first) return
                      setCreateInColumn({ id: first.id, name: first.name })
                    }}
                    className="inline-flex items-center gap-2 text-sm hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add new item...
                  </button>
                </td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
              </tr>

              {filteredRows.map((task) => (
                <tr
                  key={task.id}
                  className="border-b align-top hover:bg-muted/20"
                >
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      className="text-left"
                      onClick={() =>
                        setSelectedTask({
                          ...task,
                          columnName: task.statusName,
                        })
                      }
                    >
                      <div className="font-medium text-foreground">
                        {task.title}
                      </div>
                      {task.description ? (
                        <div className="mt-1 line-clamp-1 text-muted-foreground">
                          {task.description}
                        </div>
                      ) : null}
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-muted-foreground hover:bg-muted"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="h-2 w-2 rounded-full bg-red-500" />
                          {task.statusName}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-1" align="start">
                        {board.columns.map((column) => (
                          <button
                            key={column.id}
                            type="button"
                            className="flex w-full items-center rounded-md px-2 py-1.5 text-left hover:bg-muted"
                            onClick={() => {
                              if (column.id === task.statusColumnId) return
                              optimisticTaskMove({
                                taskId: task.id,
                                sourceColumnId: task.statusColumnId,
                                destinationColumnId: column.id,
                                destinationIndex: column.tasks.length,
                              })
                            }}
                          >
                            <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                            <span className="ml-2 flex-1">{column.name}</span>
                            {column.id === task.statusColumnId ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : null}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <UserRound className="h-3.5 w-3.5" />
                          {task.assigneeName ?? "—"}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-2" align="start">
                        <Input placeholder="Search members..." />
                        <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                          <button
                            type="button"
                            className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                            onClick={() =>
                              optimisticTaskUpdate(
                                task.id,
                                {
                                  assigneeId: null,
                                  assigneeName: null,
                                  assigneeAvatar: null,
                                },
                                { assigneeId: null }
                              )
                            }
                          >
                            Unassigned
                          </button>
                          {users.map((user) => (
                            <button
                              key={user.id}
                              type="button"
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                              onClick={() =>
                                optimisticTaskUpdate(
                                  task.id,
                                  {
                                    assigneeId: user.id,
                                    assigneeName: user.name,
                                    assigneeAvatar: user.avatarUrl,
                                  },
                                  { assigneeId: user.id }
                                )
                              }
                            >
                              <Avatar className="h-6 w-6">
                                <AvatarImage
                                  src={user.avatarUrl ?? undefined}
                                />
                                <AvatarFallback className="text-[10px]">
                                  {user.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="truncate text-sm">
                                  {user.name}
                                </div>
                                <div className="truncate text-xs text-muted-foreground">
                                  {user.email}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <CalendarDays className="h-3.5 w-3.5" />
                          {task.dueDate
                            ? new Date(task.dueDate).toLocaleDateString()
                            : "—"}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-3" align="start">
                        <Input
                          type="date"
                          defaultValue={
                            task.dueDate
                              ? new Date(task.dueDate)
                                  .toISOString()
                                  .slice(0, 10)
                              : ""
                          }
                          onChange={(e) =>
                            optimisticTaskUpdate(
                              task.id,
                              {
                                dueDate: e.target.value
                                  ? new Date(`${e.target.value}T00:00:00`)
                                  : null,
                              },
                              {
                                dueDate: e.target.value
                                  ? new Date(
                                      `${e.target.value}T00:00:00`
                                    ).toISOString()
                                  : null,
                              }
                            )
                          }
                        />
                      </PopoverContent>
                    </Popover>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Flag className="h-3.5 w-3.5" />
                          {task.priority
                            ? `P${
                                task.priority === "urgent"
                                  ? "1"
                                  : task.priority === "high"
                                    ? "2"
                                    : task.priority === "medium"
                                      ? "3"
                                      : "4"
                              }`
                            : "—"}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-44 p-1" align="start">
                        {[
                          { key: "urgent", label: "Urgent" },
                          { key: "high", label: "High" },
                          { key: "medium", label: "Medium" },
                          { key: "low", label: "Low" },
                        ].map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            className="flex w-full items-center rounded-md px-2 py-1.5 text-left hover:bg-muted"
                            onClick={() =>
                              optimisticTaskUpdate(
                                task.id,
                                {
                                  priority: option.key,
                                },
                                {
                                  priority: option.key as
                                    | "urgent"
                                    | "high"
                                    | "medium"
                                    | "low",
                                }
                              )
                            }
                          >
                            <Flag className="h-3.5 w-3.5" />
                            <span className="ml-2 flex-1">{option.label}</span>
                            {task.priority === option.key ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : null}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Tag className="h-3.5 w-3.5" />
                          {task.labels && task.labels.length > 0
                            ? task.labels.join(", ")
                            : "—"}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-2" align="start">
                        <Input
                          value={labelDraftByTask[task.id] ?? ""}
                          onChange={(e) =>
                            setLabelDraftByTask((prev) => ({
                              ...prev,
                              [task.id]: e.target.value,
                            }))
                          }
                          placeholder="Add a label..."
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return
                            e.preventDefault()
                            const raw = (labelDraftByTask[task.id] ?? "")
                              .trim()
                              .toLowerCase()
                            if (!raw) return
                            const current = task.labels ?? []
                            if (current.includes(raw)) return
                            optimisticTaskUpdate(
                              task.id,
                              {
                                labels: [...current, raw],
                              },
                              {
                                labels: [...current, raw],
                              }
                            )
                            setLabelDraftByTask((prev) => ({
                              ...prev,
                              [task.id]: "",
                            }))
                          }}
                        />
                        <div className="mt-2 flex flex-wrap gap-1">
                          {[
                            "bug",
                            "backend",
                            "frontend",
                            "urgent",
                            "design",
                          ].map((label) => {
                            const current = task.labels ?? []
                            const exists = current.includes(label)
                            return (
                              <button
                                key={label}
                                type="button"
                                disabled={exists}
                                className={cn(
                                  "rounded-md border px-2 py-1 text-xs",
                                  exists
                                    ? "cursor-default opacity-50"
                                    : "hover:bg-muted"
                                )}
                                onClick={() => {
                                  if (exists) return
                                  optimisticTaskUpdate(
                                    task.id,
                                    {
                                      labels: [...current, label],
                                    },
                                    {
                                      labels: [...current, label],
                                    }
                                  )
                                }}
                              >
                                {label}
                              </button>
                            )
                          })}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(task.labels ?? []).map((label) => (
                            <button
                              key={label}
                              type="button"
                              className="rounded-md bg-muted px-2 py-1 text-xs"
                              onClick={() =>
                                optimisticTaskUpdate(
                                  task.id,
                                  {
                                    labels: (task.labels ?? []).filter(
                                      (item) => item !== label
                                    ),
                                  },
                                  {
                                    labels: (task.labels ?? []).filter(
                                      (item) => item !== label
                                    ),
                                  }
                                )
                              }
                            >
                              {label} ×
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createInColumn ? (
        <CreateTaskDialog
          open={Boolean(createInColumn)}
          onOpenChange={(open) => !open && setCreateInColumn(null)}
          boardId={board.id}
          columnId={createInColumn.id}
          columnName={createInColumn.name}
          workspaceId={board.workspaceId}
        />
      ) : null}

      {selectedTask ? (
        <TaskDetailDialog
          key={selectedTask.id}
          open={Boolean(selectedTask)}
          onOpenChange={(open) => !open && setSelectedTask(null)}
          task={selectedTask}
        />
      ) : null}
    </div>
  )
}
