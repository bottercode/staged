"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { skipToken } from "@tanstack/react-query"
import { Hash, Lock, Users, Settings } from "lucide-react"
import { trpc } from "@/lib/trpc/client"
import { MESSAGE_POLL_QUERY_OPTIONS } from "@/lib/polling"
import { useCurrentUser } from "@/lib/user-context"
import { readSelectedWorkspaceId } from "@/lib/workspace-selection"
import { MessageList, type Message } from "@/components/message-list"
import { MessageInput } from "@/components/message-input"
import { ThreadPanel } from "@/components/thread-panel"
import { CreateTaskFromMessageDialog } from "@/components/create-task-from-message-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function ChannelPage() {
  const params = useParams<{ channelId: string }>()
  const channelId = params?.channelId ?? ""
  const { currentUser } = useCurrentUser()
  const [threadId, setThreadId] = useState<string | null>(null)
  const [taskMessage, setTaskMessage] = useState<Message | null>(null)
  const [showChannelSettings, setShowChannelSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState<"about" | "members">("about")
  const [draftName, setDraftName] = useState("")
  const [draftDescription, setDraftDescription] = useState("")
  const [draftIsPrivate, setDraftIsPrivate] = useState(false)
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
  const { data: channel } = trpc.channel.getById.useQuery({ id: channelId })
  const { data: channelMembers } = trpc.channel.getMembers.useQuery({
    channelId,
  })
  const { data: workspaceMembers } = trpc.workspace.getMembers.useQuery(
    workspace ? { workspaceId: workspace.id } : skipToken
  )
  const { data: users } = trpc.user.list.useQuery()
  const { data: messages } = trpc.message.list.useQuery(
    { channelId },
    MESSAGE_POLL_QUERY_OPTIONS
  )

  const sendMessage = trpc.message.send.useMutation({
    onMutate: async (vars) => {
      await utils.message.list.cancel({ channelId })
      const prev = utils.message.list.getData({ channelId })
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
      }
      utils.message.list.setData({ channelId }, (old) => [
        ...(old ?? []),
        optimistic,
      ])
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.message.list.setData({ channelId }, ctx.prev)
    },
    onSettled: () => {
      utils.message.list.invalidate({ channelId })
    },
  })
  const deleteMessage = trpc.message.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.message.list.invalidate({ channelId }),
        threadId
          ? utils.message.thread.invalidate({ parentId: threadId })
          : Promise.resolve(),
      ])
    },
  })
  const updateChannel = trpc.channel.update.useMutation({
    onSuccess: async () => {
      await utils.channel.getById.invalidate({ id: channelId })
      await utils.channel.list.invalidate()
      setShowChannelSettings(false)
    },
  })

  const currentMemberRole = workspaceMembers?.find(
    (m) => m.userId === currentUser?.id
  )?.role
  const isAdmin = currentMemberRole === "admin"

  return (
    <div className="flex min-w-0 flex-1">
      {/* Main channel area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Channel header */}
        <div className="flex h-12 items-center gap-2 border-b px-4">
          {channel ? (
            <>
              {channel.isPrivate ? (
                <Lock className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Hash className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm font-semibold">{channel.name}</span>
            </>
          ) : (
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          )}
          {channel?.description && (
            <>
              <span className="text-xs text-muted-foreground">|</span>
              <span className="truncate text-xs text-muted-foreground">
                {channel.description}
              </span>
            </>
          )}
          {channel?.memberCount != null && (
            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center -space-x-2">
                {(channelMembers ?? []).slice(0, 5).map((member) => (
                  <Avatar
                    key={member.id}
                    className="h-6 w-6 border-2 border-background"
                  >
                    <AvatarImage src={member.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {member.name?.[0]?.toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {channel.memberCount}
              </div>
              {isAdmin ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs"
                  onClick={() => {
                    setDraftName(channel?.name ?? "")
                    setDraftDescription(channel?.description ?? "")
                    setDraftIsPrivate(channel?.isPrivate ?? false)
                    setSettingsTab("about")
                    setShowChannelSettings(true)
                  }}
                >
                  <Settings className="h-3.5 w-3.5" />
                  Edit
                </Button>
              ) : null}
            </div>
          )}
        </div>

        {/* Messages */}
        <MessageList
          messages={messages ?? []}
          onOpenThread={setThreadId}
          onCreateTask={setTaskMessage}
          currentUserId={currentUser?.id}
          workspaceId={workspace?.id}
          onDeleteMessage={(message) => {
            deleteMessage.mutate({ messageId: message.id })
          }}
        />

        {/* Input */}
        <MessageInput
          placeholder={`Message #${channel?.name ?? "channel"}...`}
          mentionUsers={(users ?? [])
            .filter((u) => u.id !== currentUser?.id)
            .map((u) => ({ id: u.id, name: u.name }))}
          onSend={(content, attachments) => {
            if (!currentUser) return
            sendMessage.mutate({
              channelId,
              userId: currentUser.id,
              content,
              attachments,
            })
          }}
        />
      </div>

      {/* Thread panel */}
      {threadId && (
        <ThreadPanel
          parentId={threadId}
          channelId={channelId}
          workspaceId={workspace?.id}
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

      <Dialog open={showChannelSettings} onOpenChange={setShowChannelSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Channel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              <button
                type="button"
                onClick={() => setSettingsTab("about")}
                className={`rounded-md px-2 py-1 text-sm ${
                  settingsTab === "about"
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                About
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab("members")}
                className={`rounded-md px-2 py-1 text-sm ${
                  settingsTab === "members"
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                Members
              </button>
            </div>

            {settingsTab === "about" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Channel name</p>
                  <Input
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    placeholder="engineering"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Description</p>
                  <Input
                    value={draftDescription}
                    onChange={(event) =>
                      setDraftDescription(event.target.value)
                    }
                    placeholder="Channel description"
                  />
                </div>
                {channel?.slug !== "general" && (
                  <button
                    type="button"
                    onClick={() => setDraftIsPrivate((p) => !p)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      draftIsPrivate
                        ? "border-primary/40 bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div
                      className={`rounded-md p-1.5 ${draftIsPrivate ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                    >
                      <Lock className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Private channel</p>
                      <p className="text-xs text-muted-foreground">
                        {draftIsPrivate
                          ? "Only invited members can see this channel"
                          : "Anyone in the workspace can join"}
                      </p>
                    </div>
                    <div
                      className={`h-4 w-4 rounded-full border-2 transition-colors ${draftIsPrivate ? "border-primary bg-primary" : "border-muted-foreground"}`}
                    />
                  </button>
                )}
              </div>
            ) : (
              <div className="max-h-72 space-y-2 overflow-auto">
                {(channelMembers ?? []).map((member) => {
                  const role =
                    workspaceMembers?.find((wm) => wm.userId === member.id)
                      ?.role ?? "member"
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-md border p-2"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={member.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-[10px]">
                            {member.name?.[0]?.toUpperCase() ?? "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {member.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {member.email}
                          </p>
                        </div>
                      </div>
                      <span className="rounded border bg-muted px-2 py-0.5 text-xs capitalize">
                        {role}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowChannelSettings(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={
                settingsTab !== "about" ||
                !draftName.trim() ||
                updateChannel.isPending
              }
              onClick={() => {
                updateChannel.mutate({
                  id: channelId,
                  name: draftName.trim(),
                  description: draftDescription.trim() || undefined,
                  isPrivate: draftIsPrivate,
                })
              }}
            >
              {updateChannel.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
