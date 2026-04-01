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
  const [createInColumn, setCreateInColumn] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null)
  const utils = trpc.useUtils()

  const moveTask = trpc.task.move.useMutation({
    onSuccess: () => utils.board.getById.invalidate({ id: boardId }),
  })

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return

    const { draggableId, destination } = result
    moveTask.mutate({
      id: draggableId,
      columnId: destination.droppableId,
      position: destination.index,
    })
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex flex-1 gap-6 overflow-x-auto p-6">
          {columns.map((column) => {
            const dotColor =
              columnDotColors[column.name] ?? "bg-muted-foreground"

            return (
              <div
                key={column.id}
                className="flex w-80 flex-shrink-0 flex-col rounded-xl bg-neutral-100 dark:bg-neutral-900"
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
                                onClick={() => setSelectedTask(task)}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      <button
                        onClick={() => setCreateInColumn(column.id)}
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

          {/* Add column */}
          <button className="flex h-10 w-40 flex-shrink-0 items-center justify-center gap-1.5 self-start rounded-lg text-xs text-muted-foreground transition-colors hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-900">
            <Plus className="h-3.5 w-3.5" />
            Add column
          </button>
        </div>
      </DragDropContext>

      {createInColumn && (
        <CreateTaskDialog
          open={!!createInColumn}
          onOpenChange={(open) => !open && setCreateInColumn(null)}
          boardId={boardId}
          columnId={createInColumn}
          workspaceId={workspaceId}
        />
      )}

      {selectedTask && (
        <TaskDetailDialog
          open={!!selectedTask}
          onOpenChange={(open) => !open && setSelectedTask(null)}
          task={selectedTask}
        />
      )}
    </>
  )
}
