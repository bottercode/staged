"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { skipToken } from "@tanstack/react-query"
import { Hash, Lock, Users, Settings, X, PanelRight } from "lucide-react"
import { trpc } from "@/lib/trpc/client"
import { MESSAGE_POLL_QUERY_OPTIONS } from "@/lib/polling"
import { useCurrentUser } from "@/lib/user-context"
import { readSelectedWorkspaceId } from "@/lib/workspace-selection"
import { MessageList, type Message } from "@/components/message-list"
import { MessageInput } from "@/components/message-input"
import { ThreadPanel } from "@/components/thread-panel"
import { ChannelInfoPanel } from "@/components/channel-info-panel"
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
  const [showInfoPanel, setShowInfoPanel] = useState(true)
  const [showChannelSettings, setShowChannelSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState<"about" | "members">("about")
  const [draftName, setDraftName] = useState("")
  const [draftDescription, setDraftDescription] = useState("")
  const [draftIsPrivate, setDraftIsPrivate] = useState(false)
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState("")
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
  const { data: users } = trpc.user.list.useQuery(
    workspace ? { workspaceId: workspace.id } : undefined,
    { enabled: Boolean(workspace) }
  )
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
        reactions: [],
        isPinned: false,
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
  const addChannelMember = trpc.channel.addMember.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.channel.getMembers.invalidate({ channelId }),
        utils.channel.getById.invalidate({ id: channelId }),
      ])
      setSelectedMemberToAdd("")
    },
  })
  const removeChannelMember = trpc.channel.removeMember.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.channel.getMembers.invalidate({ channelId }),
        utils.channel.getById.invalidate({ id: channelId }),
      ])
    },
  })

  const currentMemberRole = workspaceMembers?.find(
    (m) => m.userId === currentUser?.id
  )?.role
  const isAdmin = currentMemberRole === "admin"
  const existingChannelMemberIds = new Set(
    (channelMembers ?? []).map((m) => m.id)
  )
  const addableMembers = (workspaceMembers ?? []).filter(
    (member) => !existingChannelMemberIds.has(member.userId)
  )

  return (
    <div className="flex min-w-0 flex-1">
      {/* Main channel area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Channel header */}
        <div className="flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-5 backdrop-blur">
          {channel ? (
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground">
                {channel.isPrivate ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <Hash className="h-4 w-4" />
                )}
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[15px] leading-tight font-semibold tracking-tight">
                  {channel.name}
                </span>
                {channel.description ? (
                  <span className="truncate text-[11px] leading-tight text-muted-foreground">
                    {channel.description}
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          )}
          {channel?.memberCount != null && (
            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center -space-x-1.5">
                {(channelMembers ?? []).slice(0, 5).map((member) => (
                  <Avatar
                    key={member.id}
                    className="h-7 w-7 ring-2 ring-background"
                  >
                    <AvatarImage src={member.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {member.name?.[0]?.toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <div className="flex items-center gap-1 rounded-full bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <Users className="h-3 w-3" />
                {channel.memberCount}
              </div>
              {isAdmin ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 rounded-lg px-2.5 text-xs"
                  onClick={() => {
                    setDraftName(channel?.name ?? "")
                    setDraftDescription(channel?.description ?? "")
                    setDraftIsPrivate(channel?.isPrivate ?? false)
                    setSettingsTab("about")
                    setShowChannelSettings(true)
                  }}
                >
                  <Settings className="h-3.5 w-3.5" />
                  Settings
                </Button>
              ) : null}
              <Button
                size="icon"
                variant="ghost"
                className={`h-8 w-8 rounded-lg ${showInfoPanel ? "bg-muted/60 text-foreground" : "text-muted-foreground"}`}
                onClick={() => setShowInfoPanel((v) => !v)}
                title="Channel info"
              >
                <PanelRight className="h-4 w-4" />
              </Button>
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
          channelId={channelId}
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

      {/* Channel info panel */}
      {showInfoPanel && !threadId && (
        <ChannelInfoPanel
          channelId={channelId}
          onClose={() => setShowInfoPanel(false)}
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
        <DialogContent className="flex max-h-[85vh] w-[min(520px,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] flex-col overflow-x-hidden overflow-y-hidden p-0">
          <DialogHeader className="border-b border-border/60 px-5 py-3.5">
            <DialogTitle className="flex items-center gap-2 text-[14px] font-semibold">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground">
                {channel?.isPrivate ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  <Hash className="h-3.5 w-3.5" />
                )}
              </div>
              <span className="truncate">{channel?.name || "Channel"}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <div className="px-5 pt-4">
              <div className="flex items-center gap-1 rounded-lg bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => setSettingsTab("about")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    settingsTab === "about"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  About
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsTab("members")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    settingsTab === "members"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Members
                </button>
              </div>
            </div>

            <div className="px-5 py-4">
              {settingsTab === "about" ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <p className="px-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/80 uppercase">
                      Channel Name
                    </p>
                    <Input
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                      placeholder="engineering"
                      className="h-8 text-[12px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p className="px-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/80 uppercase">
                      Description
                    </p>
                    <Input
                      value={draftDescription}
                      onChange={(event) =>
                        setDraftDescription(event.target.value)
                      }
                      placeholder="Channel description"
                      className="h-8 text-[12px]"
                    />
                  </div>
                  {channel?.slug !== "general" && (
                    <button
                      type="button"
                      onClick={() => setDraftIsPrivate((p) => !p)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                        draftIsPrivate
                          ? "border-primary/40 bg-primary/5"
                          : "border-border/60 bg-card hover:bg-muted/40"
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${draftIsPrivate ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                      >
                        <Lock className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[13px] font-medium">
                          Private channel
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {draftIsPrivate
                            ? "Only invited members can see this channel"
                            : "Anyone in the workspace can join"}
                        </p>
                      </div>
                      <div
                        className={`h-4 w-4 rounded-full border-2 transition-colors ${draftIsPrivate ? "border-primary bg-primary" : "border-muted-foreground/40"}`}
                      />
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3 overflow-x-hidden">
                  {isAdmin ? (
                    <div className="flex items-center gap-1.5">
                      <select
                        value={selectedMemberToAdd}
                        onChange={(event) =>
                          setSelectedMemberToAdd(event.target.value)
                        }
                        className="h-8 w-0 min-w-0 flex-1 rounded-md border border-border/60 bg-background px-2.5 text-[12px]"
                      >
                        <option value="">Add member...</option>
                        {addableMembers.map((member) => (
                          <option key={member.userId} value={member.userId}>
                            {member.name} ({member.email})
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        className="h-8 rounded-md text-[12px]"
                        disabled={
                          !selectedMemberToAdd || addChannelMember.isPending
                        }
                        onClick={() => {
                          if (!selectedMemberToAdd) return
                          addChannelMember.mutate({
                            channelId,
                            userId: selectedMemberToAdd,
                          })
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  ) : null}

                  <div className="max-h-72 divide-y divide-border/60 overflow-hidden overflow-y-auto rounded-xl border border-border/60 bg-card">
                    {(channelMembers ?? []).map((member) => {
                      const role =
                        workspaceMembers?.find((wm) => wm.userId === member.id)
                          ?.role ?? "member"
                      return (
                        <div
                          key={member.id}
                          className="flex items-center gap-2.5 px-3 py-2"
                        >
                          <Avatar className="h-7 w-7 shrink-0 ring-1 ring-border/60">
                            <AvatarImage src={member.avatarUrl ?? undefined} />
                            <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                              {member.name?.[0]?.toUpperCase() ?? "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium">
                              {member.name}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {member.email}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
                            {role}
                          </span>
                          {isAdmin &&
                          channel?.slug !== "general" &&
                          member.id !== currentUser?.id ? (
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              className="h-6 w-6 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              disabled={removeChannelMember.isPending}
                              onClick={() =>
                                removeChannelMember.mutate({
                                  channelId,
                                  userId: member.id,
                                })
                              }
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="border-t border-border/60 px-5 pt-3 pb-6">
            {settingsTab === "about" ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-md text-[12px]"
                  onClick={() => setShowChannelSettings(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-8 rounded-md text-[12px]"
                  disabled={!draftName.trim() || updateChannel.isPending}
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
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-md text-[12px]"
                onClick={() => setShowChannelSettings(false)}
              >
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
