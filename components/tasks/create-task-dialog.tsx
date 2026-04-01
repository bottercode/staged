"use client"

import { useState } from "react"
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

export function CreateTaskDialog({
  open,
  onOpenChange,
  boardId,
  columnId,
  workspaceId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  boardId: string
  columnId: string
  workspaceId: string
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState("medium")
  const [assigneeId, setAssigneeId] = useState<string>("")
  const [dueDate, setDueDate] = useState("")
  const { currentUser, users } = useCurrentUser()
  const utils = trpc.useUtils()

  const createTask = trpc.task.create.useMutation({
    onSuccess: () => {
      utils.board.getById.invalidate()
      onOpenChange(false)
      setTitle("")
      setDescription("")
      setPriority("medium")
      setAssigneeId("")
      setDueDate("")
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!title.trim() || !currentUser) return
            createTask.mutate({
              boardId,
              columnId,
              workspaceId,
              title: title.trim(),
              description: description.trim() || undefined,
              priority: priority as "low" | "medium" | "high" | "urgent",
              assigneeId: assigneeId || undefined,
              dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
              createdById: currentUser.id,
            })
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="mt-1"
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Description <span className="text-muted-foreground">(optional)</span>
            </label>
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

          <div className="flex justify-end">
            <Button type="submit" disabled={!title.trim()}>
              Create Task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
