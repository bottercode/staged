"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { Hash, Users } from "lucide-react"
import { trpc } from "@/lib/trpc/client"
import { useCurrentUser } from "@/lib/user-context"
import { MessageList, type Message } from "@/components/message-list"
import { MessageInput } from "@/components/message-input"
import { ThreadPanel } from "@/components/thread-panel"
import { CreateTaskFromMessageDialog } from "@/components/create-task-from-message-dialog"

export default function ChannelPage() {
  const { channelId } = useParams<{ channelId: string }>()
  const { currentUser } = useCurrentUser()
  const [threadId, setThreadId] = useState<string | null>(null)
  const [taskMessage, setTaskMessage] = useState<Message | null>(null)
  const utils = trpc.useUtils()

  const { data: workspace } = trpc.workspace.getDefault.useQuery()
  const { data: channel } = trpc.channel.getById.useQuery({ id: channelId })
  const { data: messages } = trpc.message.list.useQuery(
    { channelId },
    { refetchInterval: 3000 }
  )

  const sendMessage = trpc.message.send.useMutation({
    onSuccess: () => {
      utils.message.list.invalidate({ channelId })
    },
  })

  return (
    <div className="flex min-w-0 flex-1">
      {/* Main channel area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Channel header */}
        <div className="flex h-12 items-center gap-2 border-b px-4">
          <Hash className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">{channel?.name}</span>
          {channel?.description && (
            <>
              <span className="text-xs text-muted-foreground">|</span>
              <span className="truncate text-xs text-muted-foreground">
                {channel.description}
              </span>
            </>
          )}
          {channel?.memberCount != null && (
            <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {channel.memberCount}
            </div>
          )}
        </div>

        {/* Messages */}
        <MessageList
          messages={messages ?? []}
          onOpenThread={setThreadId}
          onCreateTask={setTaskMessage}
          currentUserId={currentUser?.id}
        />

        {/* Input */}
        <MessageInput
          placeholder={`Message #${channel?.name ?? "channel"}...`}
          onSend={(content) => {
            if (!currentUser) return
            sendMessage.mutate({
              channelId,
              userId: currentUser.id,
              content,
            })
          }}
        />
      </div>

      {/* Thread panel */}
      {threadId && (
        <ThreadPanel
          parentId={threadId}
          channelId={channelId}
          onClose={() => setThreadId(null)}
        />
      )}

      {/* Create task from message dialog */}
      {taskMessage && workspace && (
        <CreateTaskFromMessageDialog
          open={!!taskMessage}
          onOpenChange={(open) => !open && setTaskMessage(null)}
          messageContent={taskMessage.content}
          messageId={taskMessage.id}
          messageAuthor={taskMessage.userName}
          workspaceId={workspace.id}
        />
      )}
    </div>
  )
}
