"use client"

import { X } from "lucide-react"
import { trpc } from "@/lib/trpc/client"
import { MESSAGE_POLL_QUERY_OPTIONS } from "@/lib/polling"
import { useCurrentUser } from "@/lib/user-context"
import { MessageList } from "./message-list"
import { MessageInput } from "./message-input"
import { Button } from "@/components/ui/button"

export function ThreadPanel({
  parentId,
  channelId,
  workspaceId,
  onClose,
}: {
  parentId: string
  channelId: string
  workspaceId?: string
  onClose: () => void
}) {
  const { currentUser } = useCurrentUser()
  const utils = trpc.useUtils()
  const { data: users } = trpc.user.list.useQuery(
    workspaceId ? { workspaceId } : undefined
  )

  const { data: thread } = trpc.message.thread.useQuery(
    { parentId },
    MESSAGE_POLL_QUERY_OPTIONS
  )

  const sendMessage = trpc.message.send.useMutation({
    onSuccess: () => {
      utils.message.thread.invalidate({ parentId })
      utils.message.list.invalidate({ channelId })
    },
  })
  const deleteMessage = trpc.message.delete.useMutation({
    onSuccess: () => {
      utils.message.thread.invalidate({ parentId })
      utils.message.list.invalidate({ channelId })
    },
  })

  const allMessages = thread?.replies ?? []

  return (
    <div className="flex h-full min-h-0 w-[340px] flex-shrink-0 flex-col border-l xl:w-[420px]">
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-b px-4">
        <span className="text-sm font-semibold">Thread</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <MessageList
        messages={allMessages}
        currentUserId={currentUser?.id}
        workspaceId={workspaceId}
        onDeleteMessage={(message) => {
          deleteMessage.mutate({ messageId: message.id })
        }}
        showThreadCount={false}
      />

      {/* Input */}
      <MessageInput
        placeholder="Reply in thread..."
        mentionUsers={(users ?? [])
          .filter((u) => u.id !== currentUser?.id)
          .map((u) => ({ id: u.id, name: u.name }))}
        onSend={(content, attachments) => {
          if (!currentUser) return
          sendMessage.mutate({
            channelId,
            userId: currentUser.id,
            content,
            parentId,
            attachments,
          })
        }}
      />
    </div>
  )
}
