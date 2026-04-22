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
import { MessageSquare } from "lucide-react"

export function CreateTaskFromMessageDialog({
  open,
  onOpenChange,
  messageContent,
  messageId,
  messageAuthor,
  workspaceId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  messageContent: string
  messageId: string
  messageAuthor: string
  workspaceId: string
}) {
  const [title, setTitle] = useState(messageContent.slice(0, 200))
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState("medium")
  const [assigneeId, setAssigneeId] = useState<string>("")
  const [selectedBoardId, setSelectedBoardId] = useState<string>("")
  const [selectedColumnId, setSelectedColumnId] = useState<string>("")

  const { currentUser, users } = useCurrentUser()
  const utils = trpc.useUtils()

  const { data: boards } = trpc.board.list.useQuery(
    { workspaceId },
    { enabled: open }
  )

  const { data: board } = trpc.board.getById.useQuery(
    { id: selectedBoardId },
    { enabled: !!selectedBoardId }
  )

  const columns = board?.columns ?? []

  // Auto-select first board and first column
  if (boards && boards.length > 0 && !selectedBoardId) {
    setSelectedBoardId(boards[0].id)
  }
  if (columns.length > 0 && !selectedColumnId) {
    setSelectedColumnId(columns[0].id)
  }

  const createTask = trpc.task.create.useMutation({
    onSuccess: () => {
      utils.board.getById.invalidate()
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create task from message</DialogTitle>
        </DialogHeader>

        {/* Source message preview */}
        <div className="flex items-start gap-2 rounded-md border bg-muted/50 p-3">
          <MessageSquare className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <span className="text-xs font-medium text-muted-foreground">
              {messageAuthor}
            </span>
            <p className="text-sm leading-relaxed line-clamp-3">
              {messageContent}
            </p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!title.trim() || !currentUser || !selectedColumnId) return
            createTask.mutate({
              boardId: selectedBoardId,
              columnId: selectedColumnId,
              workspaceId,
              title: title.trim(),
              description: description.trim() || undefined,
              priority: priority as "low" | "medium" | "high" | "urgent",
              assigneeId: assigneeId || undefined,
              channelMessageId: messageId,
            })
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className="mt-1"
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Description{" "}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more details..."
              rows={2}
              className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Board</label>
              <Select value={selectedBoardId} onValueChange={(v) => {
                setSelectedBoardId(v)
                setSelectedColumnId("")
              }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select board" />
                </SelectTrigger>
                <SelectContent>
                  {boards?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Column</label>
              <Select value={selectedColumnId} onValueChange={setSelectedColumnId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!title.trim() || !selectedColumnId || createTask.isPending}
            >
              Create Task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
