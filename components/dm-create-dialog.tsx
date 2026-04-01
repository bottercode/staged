"use client"

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
  const { data: users } = trpc.user.list.useQuery()
  const router = useRouter()
  const utils = trpc.useUtils()

  const createDm = trpc.dm.create.useMutation({
    onSuccess: (result) => {
      utils.dm.list.invalidate()
      onOpenChange(false)
      router.push(`/workspace/dm/${result.id}`)
    },
  })

  const otherUsers = users?.filter((u) => u.id !== currentUser?.id) ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New direct message</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          {otherUsers.map((user) => (
            <button
              key={user.id}
              onClick={() => {
                if (!workspaceId || !currentUser) return
                createDm.mutate({
                  workspaceId,
                  userId: currentUser.id,
                  otherUserId: user.id,
                })
              }}
              className="hover:bg-accent flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.avatarUrl ?? undefined} />
                <AvatarFallback>{user.name[0]}</AvatarFallback>
              </Avatar>
              <div className="text-left">
                <div className="font-medium">{user.name}</div>
                <div className="text-muted-foreground text-xs">
                  {user.email}
                </div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
