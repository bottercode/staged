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
import { useRouter } from "next/navigation"

export function PortalCreateDialog({
  open,
  onOpenChange,
  workspaceId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId?: string
}) {
  const [name, setName] = useState("")
  const [clientName, setClientName] = useState("")
  const [clientEmail, setClientEmail] = useState("")
  const [description, setDescription] = useState("")
  const [boardId, setBoardId] = useState<string>("")
  const { currentUser } = useCurrentUser()
  const router = useRouter()
  const utils = trpc.useUtils()

  const { data: boards } = trpc.board.list.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId && open }
  )

  const createPortal = trpc.portal.create.useMutation({
    onSuccess: (portal) => {
      utils.portal.list.invalidate()
      onOpenChange(false)
      setName("")
      setClientName("")
      setClientEmail("")
      setDescription("")
      setBoardId("")
      router.push(`/workspace/portals/${portal.id}`)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create client portal</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!workspaceId || !name.trim() || !clientName.trim() || !currentUser)
              return
            createPortal.mutate({
              workspaceId,
              name: name.trim(),
              clientName: clientName.trim(),
              clientEmail: clientEmail.trim() || undefined,
              description: description.trim() || undefined,
              boardId: boardId || undefined,
              createdById: currentUser.id,
            })
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-sm font-medium">Portal name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp Portal"
              className="mt-1"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Client name</label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. John Doe"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Client email{" "}
                <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="john@acme.com"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">
              Description{" "}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description visible to client..."
              rows={2}
              className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Link to board{" "}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <Select value={boardId} onValueChange={setBoardId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="No board linked" />
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

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!name.trim() || !clientName.trim()}
            >
              Create Portal
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
