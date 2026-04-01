"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { SendHorizonal, AtSign, Smile } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import EmojiPicker from "emoji-picker-react"
import { cn } from "@/lib/utils"

export function MessageInput({
  onSend,
  placeholder = "Type a message...",
  disabled = false,
  mentionUsers = [],
}: {
  onSend: (content: string) => void
  placeholder?: string
  disabled?: boolean
  mentionUsers?: Array<{ id: string; name: string }>
}) {
  const [value, setValue] = useState("")
  const [activeMention, setActiveMention] = useState<{
    query: string
    start: number
    end: number
  } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const content = value.trim()
    if (!content) return
    onSend(content)
    setValue("")
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }, [value, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target
    const nextValue = el.value
    setValue(nextValue)
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 160) + "px"

    const caret = el.selectionStart ?? nextValue.length
    const leftOfCaret = nextValue.slice(0, caret)
    const match = leftOfCaret.match(/(?:^|\s)@([a-zA-Z0-9._-]*)$/)
    if (!match) {
      setActiveMention(null)
      return
    }

    const query = match[1] ?? ""
    const start = caret - query.length - 1
    setActiveMention({ query, start, end: caret })
  }

  const filteredMentionUsers = mentionUsers.filter((user) =>
    user.name.toLowerCase().includes((activeMention?.query ?? "").toLowerCase())
  )

  const insertMention = (name: string) => {
    if (!activeMention) return
    const nextValue =
      value.slice(0, activeMention.start) +
      `@${name} ` +
      value.slice(activeMention.end)
    setValue(nextValue)
    setActiveMention(null)
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      const nextCaret = activeMention.start + name.length + 2
      el.focus()
      el.setSelectionRange(nextCaret, nextCaret)
      el.style.height = "auto"
      el.style.height = Math.min(el.scrollHeight, 160) + "px"
    })
  }

  return (
    <div className="border-t px-4 py-3">
      <div className="bg-muted/50 relative flex items-end gap-2 rounded-lg border px-3 py-2">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 flex-shrink-0"
          onClick={() => {
            setValue((v) => `${v}@`)
            requestAnimationFrame(() => textareaRef.current?.focus())
          }}
        >
          <AtSign className="h-4 w-4" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 flex-shrink-0"
            >
              <Smile className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto border-0 bg-transparent p-0">
            <EmojiPicker
              onEmojiClick={({ emoji }) => {
                setValue((v) => `${v}${emoji}`)
                requestAnimationFrame(() => textareaRef.current?.focus())
              }}
            />
          </PopoverContent>
        </Popover>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button
          size="icon"
          className="h-8 w-8 flex-shrink-0"
          onClick={handleSend}
          disabled={!value.trim() || disabled}
        >
          <SendHorizonal className="h-4 w-4" />
        </Button>

        {activeMention && filteredMentionUsers.length > 0 && (
          <div className="absolute right-2 bottom-12 z-20 max-h-56 w-64 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
            {filteredMentionUsers.slice(0, 8).map((user) => (
              <button
                key={user.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertMention(user.name)}
                className={cn(
                  "w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent",
                  "focus:bg-accent focus:outline-none"
                )}
              >
                @{user.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
