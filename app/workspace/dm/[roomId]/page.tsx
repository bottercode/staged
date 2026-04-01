"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { MessageSquare } from "lucide-react"
import { trpc } from "@/lib/trpc/client"
import { useCurrentUser } from "@/lib/user-context"
import { MessageList, type Message } from "@/components/message-list"
import { MessageInput } from "@/components/message-input"
import { CreateTaskFromMessageDialog } from "@/components/create-task-from-message-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function DmPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const { currentUser } = useCurrentUser()
  const [taskMessage, setTaskMessage] = useState<Message | null>(null)
  const utils = trpc.useUtils()

  const { data: workspace } = trpc.workspace.getDefault.useQuery()
  const { data: dmRooms } = trpc.dm.list.useQuery(
    { workspaceId: workspace?.id!, userId: currentUser?.id! },
    { enabled: !!workspace && !!currentUser }
  )

  const { data: messages } = trpc.dm.messages.useQuery(
    { roomId },
    { refetchInterval: 3000 }
  )

  const sendMessage = trpc.message.send.useMutation({
    onSuccess: () => {
      utils.dm.messages.invalidate({ roomId })
    },
  })

  // Find the other user in this DM
  const currentRoom = dmRooms?.find((r) => r.id === roomId)
  const otherUser = currentRoom?.members[0]

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* DM header */}
      <div className="flex h-12 items-center gap-2 border-b px-4">
        {otherUser && (
          <Avatar className="h-6 w-6">
            <AvatarImage src={otherUser.avatarUrl ?? undefined} />
            <AvatarFallback>{otherUser.name[0]}</AvatarFallback>
          </Avatar>
        )}
        <span className="text-sm font-semibold">
          {otherUser?.name ?? "Direct Message"}
        </span>
      </div>

      {/* Messages */}
      <MessageList
        messages={messages ?? []}
        onCreateTask={setTaskMessage}
        currentUserId={currentUser?.id}
      />

      {/* Input */}
      <MessageInput
        placeholder={`Message ${otherUser?.name ?? "..."}...`}
        onSend={(content) => {
          if (!currentUser) return
          sendMessage.mutate({
            dmRoomId: roomId,
            userId: currentUser.id,
            content,
          })
        }}
      />

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
