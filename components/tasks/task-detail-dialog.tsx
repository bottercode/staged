"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"
import { trpc } from "@/lib/trpc/client"
import { useCurrentUser } from "@/lib/user-context"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TaskData } from "./task-card"

export function TaskDetailDialog({
  open,
  onOpenChange,
  task,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: TaskData
}) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? "")
  const [priority, setPriority] = useState(task.priority)
  const [assigneeId, setAssigneeId] = useState(task.assigneeId ?? "")
  const [dueDate, setDueDate] = useState(
    task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""
  )
  const { users } = useCurrentUser()
  const utils = trpc.useUtils()

  const updateTask = trpc.task.update.useMutation({
    onSuccess: () => {
      utils.board.getById.invalidate()
      onOpenChange(false)
    },
  })

  const deleteTask = trpc.task.delete.useMutation({
    onSuccess: () => {
      utils.board.getById.invalidate()
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!title.trim()) return
            updateTask.mutate({
              id: task.id,
              title: title.trim(),
              description: description.trim() || null,
              priority: priority as "low" | "medium" | "high" | "urgent",
              assigneeId: assigneeId || null,
              dueDate: dueDate ? new Date(dueDate).toISOString() : null,
            })
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more details..."
              rows={3}
              className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Assignee</label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Due date</label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="flex justify-between">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => deleteTask.mutate({ id: task.id })}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Delete
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
