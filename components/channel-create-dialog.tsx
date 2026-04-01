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
  const router = useRouter()
  const utils = trpc.useUtils()

  const createChannel = trpc.channel.create.useMutation({
    onSuccess: (channel) => {
      utils.channel.list.invalidate()
      onOpenChange(false)
      setName("")
      setDescription("")
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
          <div className="flex justify-end">
            <Button type="submit" disabled={!name.trim()}>
              Create Channel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
