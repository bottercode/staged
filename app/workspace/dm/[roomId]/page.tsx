"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { skipToken } from "@tanstack/react-query"
import { trpc } from "@/lib/trpc/client"
import { MESSAGE_POLL_QUERY_OPTIONS } from "@/lib/polling"
import { useCurrentUser } from "@/lib/user-context"
import { readSelectedWorkspaceId } from "@/lib/workspace-selection"
import { MessageList, type Message } from "@/components/message-list"
import { MessageInput } from "@/components/message-input"
import { CreateTaskFromMessageDialog } from "@/components/create-task-from-message-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function DmPage() {
  const params = useParams<{ roomId: string }>()
  const roomId = params?.roomId ?? ""
  const { currentUser } = useCurrentUser()
  const [taskMessage, setTaskMessage] = useState<Message | null>(null)
  const [preferredWorkspaceId, setPreferredWorkspaceId] = useState<
    string | undefined
  >(undefined)
  const utils = trpc.useUtils()
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreferredWorkspaceId(readSelectedWorkspaceId() || undefined)
  }, [])

  const { data: workspace } = trpc.workspace.getDefault.useQuery(
    preferredWorkspaceId ? { preferredWorkspaceId } : undefined
  )
  const { data: users } = trpc.user.list.useQuery(
    workspace ? { workspaceId: workspace.id } : undefined,
    { enabled: Boolean(workspace) }
  )
  const { data: dmRooms } = trpc.dm.list.useQuery(
    workspace && currentUser ? { workspaceId: workspace.id } : skipToken
  )

  const { data: messages } = trpc.dm.messages.useQuery(
    { roomId },
    MESSAGE_POLL_QUERY_OPTIONS
  )

  const sendMessage = trpc.message.send.useMutation({
    onMutate: async (vars) => {
      await utils.dm.messages.cancel({ roomId })
      const prev = utils.dm.messages.getData({ roomId })
      const optimistic: Message = {
        id: `optimistic-${Date.now()}`,
        content: vars.content,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: currentUser?.id ?? "",
        userName: currentUser?.name ?? "You",
        userAvatar: currentUser?.avatarUrl ?? null,
        parentId: null,
        replyCount: 0,
        replyPreviewUsers: [],
        attachments: vars.attachments ?? [],
        reactions: [],
        isPinned: false,
      }
      utils.dm.messages.setData({ roomId }, (old) => [
        ...(old ?? []),
        optimistic,
      ])
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.dm.messages.setData({ roomId }, ctx.prev)
    },
    onSettled: () => {
      utils.dm.messages.invalidate({ roomId })
    },
  })
  const deleteMessage = trpc.message.delete.useMutation({
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
        workspaceId={workspace?.id}
        onDeleteMessage={(message) => {
          deleteMessage.mutate({ messageId: message.id })
        }}
      />

      {/* Input */}
      <MessageInput
        placeholder={`Message ${otherUser?.name ?? "..."}...`}
        mentionUsers={(users ?? [])
          .filter((u) => u.id !== currentUser?.id)
          .map((u) => ({ id: u.id, name: u.name }))}
        onSend={(content, attachments) => {
          if (!currentUser) return
          sendMessage.mutate({
            dmRoomId: roomId,
            content,
            attachments,
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
