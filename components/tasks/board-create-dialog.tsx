"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export function BoardCreateDialog({
  open,
  onOpenChange,
  workspaceId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId?: string
}) {
  const [name, setName] = useState("")
  const router = useRouter()
  const utils = trpc.useUtils()

  const createBoard = trpc.board.create.useMutation({
    onSuccess: (board) => {
      utils.board.list.invalidate()
      onOpenChange(false)
      setName("")
      router.push(`/workspace/tasks/${board.id}`)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a board</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!workspaceId || !name.trim()) return
            createBoard.mutate({ workspaceId, name: name.trim() })
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-sm font-medium">Board name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Product Launch"
              className="mt-1"
              autoFocus
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={!name.trim()}>
              Create Board
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
