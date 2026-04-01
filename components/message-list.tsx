"use client"

import { useEffect, useRef } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MessageSquare, MoreHorizontal, SquareKanban } from "lucide-react"

export type Message = {
  id: string
  content: string
  createdAt: Date
  userId: string
  userName: string
  userAvatar: string | null
  parentId: string | null
  replyCount: number
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
  currentUserId: _currentUserId,
  showThreadCount = true,
}: {
  messages: Message[]
  onOpenThread?: (messageId: string) => void
  onCreateTask?: (message: Message) => void
  currentUserId?: string
  showThreadCount?: boolean
}) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevLengthRef = useRef(0)

  useEffect(() => {
    // Auto-scroll when new messages arrive
    if (messages.length > prevLengthRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
    prevLengthRef.current = messages.length
  }, [messages.length])

  const messagesWithDate = messages.map((msg, index) => {
    const msgDate = formatDate(msg.createdAt)
    const prevDate = index > 0 ? formatDate(messages[index - 1].createdAt) : null
    return { msg, msgDate, showDate: msgDate !== prevDate }
  })

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 py-2">
      {messagesWithDate.map(({ msg, msgDate, showDate }) => {

        return (
          <div key={msg.id}>
            {showDate && (
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground">
                  {msgDate}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}
            <div
              className="group -mx-2 flex cursor-pointer gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/50"
              onClick={() => onOpenThread?.(msg.id)}
            >
              <Avatar className="mt-0.5 h-8 w-8 flex-shrink-0">
                <AvatarImage src={msg.userAvatar ?? undefined} />
                <AvatarFallback>{msg.userName[0]}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold">{msg.userName}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
                <p className="text-sm leading-relaxed">{msg.content}</p>
                {showThreadCount && msg.replyCount > 0 && (
                  <span className="mt-1 flex items-center gap-1 text-xs text-primary">
                    <MessageSquare className="h-3 w-3" />
                    {msg.replyCount + 1}{" "}
                    {msg.replyCount + 1 === 1 ? "comment" : "comments"}
                  </span>
                )}
              </div>

              {/* Action menu */}
              {onCreateTask && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenuItem onClick={() => onCreateTask(msg)}>
                      <SquareKanban className="mr-2 h-4 w-4" />
                      Create task
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
