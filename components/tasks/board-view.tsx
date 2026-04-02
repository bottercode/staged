"use client"

import { useState } from "react"
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd"
import { Plus } from "lucide-react"
import { trpc } from "@/lib/trpc/client"
import { TaskCard, type TaskData } from "./task-card"
import { CreateTaskDialog } from "./create-task-dialog"
import { TaskDetailDialog } from "./task-detail-dialog"
import { cn } from "@/lib/utils"

type Column = {
  id: string
  name: string
  position: number
  tasks: TaskData[]
}

function moveTaskInColumns(params: {
  columns: Column[]
  taskId: string
  sourceColumnId: string
  sourceIndex: number
  destinationColumnId: string
  destinationIndex: number
}): Column[] {
  const {
    columns,
    taskId,
    sourceColumnId,
    sourceIndex,
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

  let task =
    sourceColumn.tasks[sourceIndex]?.id === taskId
      ? sourceColumn.tasks.splice(sourceIndex, 1)[0]
      : undefined

  if (!task) {
    const idx = sourceColumn.tasks.findIndex((item) => item.id === taskId)
    if (idx !== -1) {
      task = sourceColumn.tasks.splice(idx, 1)[0]
    }
  }
  if (!task) return columns

  const safeIndex = Math.max(0, Math.min(destinationIndex, destinationColumn.tasks.length))
  destinationColumn.tasks.splice(safeIndex, 0, task)

  return next
}

const columnDotColors: Record<string, string> = {
  "To Do": "bg-red-400",
  "In Progress": "bg-blue-500",
  Done: "bg-emerald-500",
}

export function BoardView({
  boardId,
  workspaceId,
  columns,
}: {
  boardId: string
  workspaceId: string
  columns: Column[]
}) {
  const [createInColumn, setCreateInColumn] = useState<{
    id: string
    name: string
  } | null>(null)
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null)
  const utils = trpc.useUtils()
  const moveTask = trpc.task.move.useMutation()

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return

    const { draggableId, source, destination } = result
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return
    }

    const allInput = { id: boardId, filterMode: "all" as const }
    const activeInput = { id: boardId, filterMode: "active" as const }

    const previousAll = utils.board.getById.getData(allInput)
    const previousActive = utils.board.getById.getData(activeInput)

    utils.board.getById.setData(allInput, (current) => {
      if (!current) return current
      return {
        ...current,
        columns: moveTaskInColumns({
          columns: current.columns,
          taskId: draggableId,
          sourceColumnId: source.droppableId,
          sourceIndex: source.index,
          destinationColumnId: destination.droppableId,
          destinationIndex: destination.index,
        }),
      }
    })

    utils.board.getById.setData(activeInput, (current) => {
      if (!current) return current
      return {
        ...current,
        columns: moveTaskInColumns({
          columns: current.columns,
          taskId: draggableId,
          sourceColumnId: source.droppableId,
          sourceIndex: source.index,
          destinationColumnId: destination.droppableId,
          destinationIndex: destination.index,
        }),
      }
    })

    moveTask.mutate({
      id: draggableId,
      columnId: destination.droppableId,
      position: destination.index,
    }, {
      onError: () => {
        utils.board.getById.setData(allInput, previousAll)
        utils.board.getById.setData(activeInput, previousActive)
      },
      onSettled: () => {
        utils.board.getById.invalidate({ id: boardId })
      },
    })
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex flex-1 gap-6 p-6">
          {columns.map((column) => {
            const dotColor =
              columnDotColors[column.name] ?? "bg-muted-foreground"

            return (
              <div
                key={column.id}
                className="flex min-w-0 flex-1 flex-col rounded-xl bg-neutral-100 dark:bg-neutral-900"
              >
                {/* Column header */}
                <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                  <span className={cn("h-2 w-2 rounded-full", dotColor)} />
                  <span className="text-sm font-semibold">{column.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {column.tasks.length}
                  </span>
                </div>

                {/* Tasks */}
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "flex min-h-[40px] flex-1 flex-col gap-2 px-2.5",
                        snapshot.isDraggingOver &&
                          "bg-neutral-200/50 dark:bg-neutral-800/50"
                      )}
                    >
                      {column.tasks.map((task, index) => (
                        <Draggable
                          key={task.id}
                          draggableId={task.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={
                                snapshot.isDragging ? "opacity-90" : ""
                              }
                            >
                              <TaskCard
                                task={task}
                                boardId={boardId}
                                onClick={() =>
                                  setSelectedTask({
                                    ...task,
                                    columnName: column.name,
                                  })
                                }
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      <button
                        onClick={() =>
                          setCreateInColumn({
                            id: column.id,
                            name: column.name,
                          })
                        }
                        className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs text-muted-foreground transition-colors hover:bg-neutral-200 hover:text-foreground dark:hover:bg-neutral-800"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add card
                      </button>
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>

      {createInColumn && (
        <CreateTaskDialog
          open={!!createInColumn}
          onOpenChange={(open) => !open && setCreateInColumn(null)}
          boardId={boardId}
          columnId={createInColumn.id}
          columnName={createInColumn.name}
          workspaceId={workspaceId}
        />
      )}

      {selectedTask && (
        <TaskDetailDialog
          key={selectedTask.id}
          open={!!selectedTask}
          onOpenChange={(open) => !open && setSelectedTask(null)}
          task={selectedTask}
        />
      )}
    </>
  )
}
