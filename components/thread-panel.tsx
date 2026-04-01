"use client"

import { X } from "lucide-react"
import { trpc } from "@/lib/trpc/client"
import { useCurrentUser } from "@/lib/user-context"
import { MessageList } from "./message-list"
import { MessageInput } from "./message-input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

export function ThreadPanel({
  parentId,
  channelId,
  onClose,
}: {
  parentId: string
  channelId: string
  onClose: () => void
}) {
  const { currentUser } = useCurrentUser()
  const utils = trpc.useUtils()

  const { data: thread } = trpc.message.thread.useQuery(
    { parentId },
    { refetchInterval: 3000 }
  )

  const sendMessage = trpc.message.send.useMutation({
    onSuccess: () => {
      utils.message.thread.invalidate({ parentId })
      utils.message.list.invalidate({ channelId })
    },
  })

  const allMessages = thread
    ? [thread.parent, ...thread.replies].filter(Boolean)
    : []

  return (
    <div className="flex h-full w-80 flex-shrink-0 flex-col border-l">
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-b px-4">
        <span className="text-sm font-semibold">Thread</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <MessageList messages={allMessages} currentUserId={currentUser?.id} />

      {/* Input */}
      <MessageInput
        placeholder="Reply in thread..."
        onSend={(content) => {
          if (!currentUser) return
          sendMessage.mutate({
            channelId,
            userId: currentUser.id,
            content,
            parentId,
          })
        }}
      />
    </div>
  )
}
