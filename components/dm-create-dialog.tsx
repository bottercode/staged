"use client"

import { skipToken } from "@tanstack/react-query"
import { trpc } from "@/lib/trpc/client"
import { useCurrentUser } from "@/lib/user-context"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useRouter } from "next/navigation"

export function DmCreateDialog({
  open,
  onOpenChange,
  workspaceId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId?: string
}) {
  const { currentUser } = useCurrentUser()
  const { data: members } = trpc.workspace.getMembers.useQuery(
    workspaceId ? { workspaceId } : skipToken
  )
  const router = useRouter()
  const utils = trpc.useUtils()

  const createDm = trpc.dm.create.useMutation({
    onSuccess: (result) => {
      utils.dm.list.invalidate()
      onOpenChange(false)
      router.push(`/workspace/dm/${result.id}`)
    },
  })

  const otherUsers = members?.filter((m) => m.userId !== currentUser?.id) ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New direct message</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          {otherUsers.map((member) => (
            <button
              key={member.userId}
              onClick={() => {
                if (!workspaceId || !currentUser) return
                createDm.mutate({
                  workspaceId,
                  otherUserId: member.userId,
                })
              }}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={member.avatarUrl ?? undefined} />
                <AvatarFallback>{member.name[0]}</AvatarFallback>
              </Avatar>
              <div className="text-left">
                <div className="font-medium">{member.name}</div>
                <div className="text-xs text-muted-foreground">
                  {member.email}
                </div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
