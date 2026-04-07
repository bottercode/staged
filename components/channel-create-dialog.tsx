"use client"

import { useState } from "react"
import { Lock } from "lucide-react"
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

export function ChannelCreateDialog({
  open,
  onOpenChange,
  workspaceId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId?: string
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isPrivate, setIsPrivate] = useState(false)
  const router = useRouter()
  const utils = trpc.useUtils()

  const createChannel = trpc.channel.create.useMutation({
    onSuccess: (channel) => {
      utils.channel.list.invalidate()
      onOpenChange(false)
      setName("")
      setDescription("")
      setIsPrivate(false)
      router.push(`/workspace/channel/${channel.id}`)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a channel</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!workspaceId || !name.trim()) return
            createChannel.mutate({
              workspaceId,
              name: name.trim(),
              description: description.trim() || undefined,
              isPrivate,
            })
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. design"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">
              Description{" "}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this channel about?"
              className="mt-1"
            />
          </div>
          <button
            type="button"
            onClick={() => setIsPrivate((p) => !p)}
            className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
              isPrivate ? "border-primary/40 bg-primary/5" : "hover:bg-muted/50"
            }`}
          >
            <div
              className={`rounded-md p-1.5 ${isPrivate ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
            >
              <Lock className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Private channel</p>
              <p className="text-xs text-muted-foreground">
                {isPrivate
                  ? "Only invited members can see this channel"
                  : "Anyone in the workspace can join"}
              </p>
            </div>
            <div
              className={`h-4 w-4 rounded-full border-2 transition-colors ${isPrivate ? "border-primary bg-primary" : "border-muted-foreground"}`}
            />
          </button>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!name.trim() || createChannel.isPending}
            >
              Create Channel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
