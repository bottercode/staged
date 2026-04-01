"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { SendHorizonal } from "lucide-react"

export function MessageInput({
  onSend,
  placeholder = "Type a message...",
  disabled = false,
}: {
  onSend: (content: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  const [value, setValue] = useState("")
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
    setValue(e.target.value)
    const el = e.target
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 160) + "px"
  }

  return (
    <div className="border-t px-4 py-3">
      <div className="bg-muted/50 flex items-end gap-2 rounded-lg border px-3 py-2">
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
      </div>
    </div>
  )
}
