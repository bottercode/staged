"use client"

import { useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Download,
  FileText,
  MoreHorizontal,
  Pin,
  PinOff,
  SmilePlus,
  SquareKanban,
  Trash2,
} from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import EmojiPicker from "emoji-picker-react"
import { cn } from "@/lib/utils"

export type Attachment = {
  url: string
  name: string
  size: number
  contentType: string
}

export type Reaction = {
  emoji: string
  count: number
  reactedByMe: boolean
  users: Array<{ id: string; name: string }>
}

export type Message = {
  id: string
  content: string
  createdAt: Date
  updatedAt: Date
  userId: string
  userName: string
  userAvatar: string | null
  parentId: string | null
  replyCount: number
  attachments: Attachment[]
  replyPreviewUsers: Array<{
    id: string
    name: string
    avatarUrl: string | null
  }>
  reactions: Reaction[]
  isPinned: boolean
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  const isImage = attachment.contentType.startsWith("image/")
  const isVideo = attachment.contentType.startsWith("video/")
  const src = attachment.url

  if (isImage) {
    return (
      <a href={src} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={src}
          alt={attachment.name}
          className="max-h-64 max-w-xs rounded-lg border object-cover"
        />
      </a>
    )
  }

  if (isVideo) {
    return (
      <video
        src={src}
        controls
        className="max-h-64 max-w-xs rounded-lg border"
      />
    )
  }

  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-64 items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2 transition-colors hover:bg-muted/70"
    >
      <FileText className="h-8 w-8 flex-shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{attachment.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatBytes(attachment.size)}
        </p>
      </div>
      <Download className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
    </a>
  )
}

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatDate(date: Date) {
  const d = new Date(date)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return "Today"
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday"
  return d.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

export function MessageList({
  messages,
  onOpenThread,
  onCreateTask,
  currentUserId,
  workspaceId,
  channelId,
  onDeleteMessage,
  showThreadCount = true,
  allowPin = true,
}: {
  messages: Message[]
  onOpenThread?: (messageId: string) => void
  onCreateTask?: (message: Message) => void
  currentUserId?: string
  workspaceId?: string
  channelId?: string
  onDeleteMessage?: (message: Message) => void
  showThreadCount?: boolean
  allowPin?: boolean
}) {
  const router = useRouter()
  const utils = trpc.useUtils()
  const { data: users } = trpc.user.list.useQuery(
    workspaceId ? { workspaceId } : undefined
  )
  const dmCreate = trpc.dm.create.useMutation({
    onSuccess: (result) => {
      router.push(`/workspace/dm/${result.id}`)
    },
  })
  const invalidateMessages = () => {
    if (channelId) utils.message.list.invalidate({ channelId })
    utils.message.thread.invalidate()
    utils.dm.messages.invalidate()
    if (channelId) utils.message.listPinned.invalidate({ channelId })
  }
  const toggleReaction = trpc.message.toggleReaction.useMutation({
    onSuccess: invalidateMessages,
  })
  const togglePin = trpc.message.togglePin.useMutation({
    onSuccess: invalidateMessages,
  })
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevLengthRef = useRef(0)
  const mentionRegex = useMemo(() => {
    const names = (users ?? [])
      .map((u) => u.name?.trim())
      .filter((name): name is string => Boolean(name))
      .sort((a, b) => b.length - a.length)
      .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    if (!names.length) return null
    return new RegExp(`@(${names.join("|")})(?=\\b|\\s|$|[,.!?;:])`, "g")
  }, [users])

  const userByName = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    for (const user of users ?? []) {
      const key = user.name.trim().toLowerCase()
      if (!map.has(key)) {
        map.set(key, { id: user.id, name: user.name })
      }
    }
    return map
  }, [users])

  const openMentionDm = (mentionName: string) => {
    if (!workspaceId || !currentUserId || dmCreate.isPending) return
    const target = userByName.get(mentionName.trim().toLowerCase())
    if (!target || target.id === currentUserId) return
    dmCreate.mutate({
      workspaceId,
      otherUserId: target.id,
    })
  }

  const renderContentWithMentions = (content: string) => {
    if (!mentionRegex) return content
    const segments: Array<{ type: "text" | "mention"; value: string }> = []
    let lastIndex = 0

    for (const match of content.matchAll(mentionRegex)) {
      const full = match[0]
      const mentionName = match[1]
      const index = match.index ?? -1
      if (index < 0) continue
      if (index > lastIndex) {
        segments.push({ type: "text", value: content.slice(lastIndex, index) })
      }
      segments.push({ type: "mention", value: mentionName })
      lastIndex = index + full.length
    }

    if (lastIndex < content.length) {
      segments.push({ type: "text", value: content.slice(lastIndex) })
    }
    if (segments.length === 0) return content

    return segments.map((segment, idx) => {
      if (segment.type === "text")
        return <span key={`t-${idx}`}>{segment.value}</span>
      return (
        <button
          key={`m-${idx}`}
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            openMentionDm(segment.value)
          }}
          className="mx-0.5 inline-flex rounded-md bg-sky-500/15 px-1.5 py-0.5 font-medium text-sky-700 transition-colors hover:bg-sky-500/25 dark:text-sky-300"
          title={`Message @${segment.value}`}
        >
          @{segment.value}
        </button>
      )
    })
  }

  useEffect(() => {
    // Auto-scroll when new messages arrive
    if (messages.length > prevLengthRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
    prevLengthRef.current = messages.length
  }, [messages.length])

  const messagesWithDate = messages.map((msg, index) => {
    const msgDate = formatDate(msg.createdAt)
    const prevDate =
      index > 0 ? formatDate(messages[index - 1].createdAt) : null
    return { msg, msgDate, showDate: msgDate !== prevDate }
  })

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-5 py-4">
      {messagesWithDate.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 text-3xl">
            👋
          </div>
          <div className="space-y-1">
            <p className="text-[15px] font-semibold tracking-tight text-foreground">
              No messages yet
            </p>
            <p className="text-xs text-muted-foreground">
              Be the first to say something!
            </p>
          </div>
        </div>
      )}
      {messagesWithDate.map(({ msg, msgDate, showDate }) => {
        if (msg.content === "joined the workspace 👋") {
          return (
            <div
              key={msg.id}
              className="my-2 flex items-center gap-3 text-xs text-muted-foreground"
            >
              <div className="h-px flex-1 bg-border/60" />
              <span>
                <span className="font-medium text-foreground">
                  {msg.userName}
                </span>{" "}
                joined the workspace 👋
              </span>
              <div className="h-px flex-1 bg-border/60" />
            </div>
          )
        }

        return (
          <div key={msg.id}>
            {showDate && (
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-border/60" />
                <span className="rounded-full border border-border/60 bg-background px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {msgDate}
                </span>
                <div className="h-px flex-1 bg-border/60" />
              </div>
            )}
            <div
              className={cn(
                "group relative -mx-2 flex cursor-pointer gap-3 rounded-xl px-3 py-2 transition-all hover:bg-muted/40",
                msg.isPinned && "bg-amber-500/[0.04] ring-1 ring-amber-500/15"
              )}
              onClick={() => onOpenThread?.(msg.id)}
            >
              <Avatar className="mt-0.5 h-9 w-9 flex-shrink-0 ring-1 ring-border/60">
                <AvatarImage src={msg.userAvatar ?? undefined} />
                <AvatarFallback>{msg.userName[0]}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                {msg.isPinned && (
                  <div className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold tracking-wide text-amber-600 uppercase dark:text-amber-400">
                    <Pin className="h-3 w-3" />
                    Pinned
                  </div>
                )}
                <div className="flex items-baseline gap-2">
                  <span className="text-[13.5px] font-semibold tracking-tight">
                    {msg.userName}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
                {msg.content && (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {renderContentWithMentions(msg.content)}
                  </p>
                )}
                {(msg.attachments ?? []).length > 0 && (
                  <div className="mt-1.5 flex flex-col gap-2">
                    {(msg.attachments ?? []).map((att, i) => (
                      <AttachmentPreview key={i} attachment={att} />
                    ))}
                  </div>
                )}
                {(msg.reactions ?? []).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {msg.reactions.map((reaction) => (
                      <button
                        key={reaction.emoji}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleReaction.mutate({
                            messageId: msg.id,
                            emoji: reaction.emoji,
                          })
                        }}
                        title={reaction.users.map((u) => u.name).join(", ")}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                          reaction.reactedByMe
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/70"
                        )}
                      >
                        <span>{reaction.emoji}</span>
                        <span className="tabular-nums">{reaction.count}</span>
                      </button>
                    ))}
                  </div>
                )}
                {showThreadCount && msg.replyCount > 0 && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpenThread?.(msg.id)
                    }}
                    className="group/thread mt-1 flex w-full max-w-sm items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/25"
                  >
                    <div className="flex items-center -space-x-2">
                      {(msg.replyPreviewUsers ?? []).slice(0, 4).map((user) => (
                        <Avatar
                          key={user.id}
                          className="h-5 w-5 border border-background"
                        >
                          <AvatarImage src={user.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-[9px]">
                            {user.name?.[0]?.toUpperCase() ?? "U"}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <span>
                      {msg.replyCount}{" "}
                      {msg.replyCount === 1 ? "reply" : "replies"}
                    </span>
                    <span className="hidden text-muted-foreground group-hover/thread:inline">
                      View thread
                    </span>
                    <span className="ml-auto hidden text-muted-foreground group-hover/thread:inline">
                      ›
                    </span>
                  </button>
                )}
              </div>

              {/* Action toolbar */}
              <div
                className="absolute -top-3 right-3 flex items-center gap-0.5 rounded-lg border border-border/60 bg-popover/95 p-0.5 opacity-0 shadow-md backdrop-blur transition-opacity group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                {currentUserId && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent"
                        title="Add reaction"
                      >
                        <SmilePlus className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      className="w-auto border-0 p-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <EmojiPicker
                        onEmojiClick={(emojiData) => {
                          toggleReaction.mutate({
                            messageId: msg.id,
                            emoji: emojiData.emoji,
                          })
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                )}
                {(onCreateTask ||
                  (allowPin && channelId && currentUserId) ||
                  (onDeleteMessage && currentUserId === msg.userId)) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent"
                        title="More actions"
                      >
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {onCreateTask ? (
                        <DropdownMenuItem onClick={() => onCreateTask(msg)}>
                          <SquareKanban className="mr-2 h-4 w-4" />
                          Create task
                        </DropdownMenuItem>
                      ) : null}
                      {allowPin && channelId && currentUserId ? (
                        <DropdownMenuItem
                          onClick={() =>
                            togglePin.mutate({ messageId: msg.id })
                          }
                        >
                          {msg.isPinned ? (
                            <>
                              <PinOff className="mr-2 h-4 w-4" />
                              Unpin message
                            </>
                          ) : (
                            <>
                              <Pin className="mr-2 h-4 w-4" />
                              Pin message
                            </>
                          )}
                        </DropdownMenuItem>
                      ) : null}
                      {onDeleteMessage && currentUserId === msg.userId ? (
                        <DropdownMenuItem
                          onClick={() => onDeleteMessage(msg)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
