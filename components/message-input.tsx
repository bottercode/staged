"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  SendHorizonal,
  AtSign,
  Smile,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code2,
  Slash,
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import EmojiPicker from "emoji-picker-react"
import { cn } from "@/lib/utils"

function exec(command: string, value?: string) {
  document.execCommand(command, false, value)
}

function htmlToMarkdown(html: string) {
  if (typeof window === "undefined") return ""
  const root = document.createElement("div")
  root.innerHTML = html

  const walk = (node: ChildNode): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent || "").replace(/\u00a0/g, " ")
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return ""

    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()
    const children = Array.from(el.childNodes).map(walk).join("")

    if (tag === "strong" || tag === "b") return `**${children}**`
    if (tag === "em" || tag === "i") return `*${children}*`
    if (tag === "u") return `<u>${children}</u>`
    if (tag === "s" || tag === "strike") return `~~${children}~~`
    if (tag === "a") return `[${children}](${el.getAttribute("href") || ""})`
    if (tag === "code") return `\`${children}\``
    if (tag === "blockquote") return children.split("\n").map((line) => line ? `> ${line}` : "> ").join("\n")
    if (tag === "li") return children
    if (tag === "ul") {
      const lines = Array.from(el.children).map((li) => `- ${walk(li)}`)
      return `${lines.join("\n")}\n`
    }
    if (tag === "ol") {
      const lines = Array.from(el.children).map((li, i) => `${i + 1}. ${walk(li)}`)
      return `${lines.join("\n")}\n`
    }
    if (tag === "br") return "\n"
    if (tag === "div" || tag === "p") return `${children}\n`

    return children
  }

  const out = Array.from(root.childNodes).map(walk).join("")
  return out.replace(/\n{3,}/g, "\n\n").trim()
}

function getMentionQuery(editor: HTMLDivElement): string | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!editor.contains(range.endContainer)) return null

  const pre = range.cloneRange()
  pre.selectNodeContents(editor)
  pre.setEnd(range.endContainer, range.endOffset)
  const text = pre.toString()
  const match = text.match(/(?:^|\s)@([a-zA-Z0-9._-]*)$/)
  return match ? match[1] ?? "" : null
}

export function MessageInput({
  onSend,
  placeholder = "Type a message...",
  disabled = false,
  mentionUsers = [],
  compact = false,
}: {
  onSend: (content: string) => void
  placeholder?: string
  disabled?: boolean
  mentionUsers?: Array<{ id: string; name: string }>
  compact?: boolean
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [html, setHtml] = useState("")
  const [plainText, setPlainText] = useState("")
  const [activeMentionQuery, setActiveMentionQuery] = useState<string | null>(null)
  const [formatState, setFormatState] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    orderedList: false,
    unorderedList: false,
    blockquote: false,
    code: false,
  })

  const filteredMentionUsers = useMemo(() => {
    if (activeMentionQuery == null) return []
    return mentionUsers
      .filter((user) =>
        user.name.toLowerCase().includes(activeMentionQuery.toLowerCase())
      )
      .slice(0, 8)
  }, [mentionUsers, activeMentionQuery])

  const focusEditor = () => editorRef.current?.focus()

  const updateFormatState = () => {
    const editor = editorRef.current
    const selection = window.getSelection()
    const inEditor =
      !!editor &&
      !!selection &&
      selection.rangeCount > 0 &&
      editor.contains(selection.anchorNode)
    if (!inEditor) {
      setFormatState({
        bold: false,
        italic: false,
        underline: false,
        strikeThrough: false,
        orderedList: false,
        unorderedList: false,
        blockquote: false,
        code: false,
      })
      return
    }
    const block = (document.queryCommandValue("formatBlock") || "")
      .toString()
      .toLowerCase()
      .replace(/[<>]/g, "")
    setFormatState({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      strikeThrough: document.queryCommandState("strikeThrough"),
      orderedList: document.queryCommandState("insertOrderedList"),
      unorderedList: document.queryCommandState("insertUnorderedList"),
      blockquote: block === "blockquote",
      code: block === "pre",
    })
  }

  useEffect(() => {
    const onSelectionChange = () => updateFormatState()
    document.addEventListener("selectionchange", onSelectionChange)
    return () => document.removeEventListener("selectionchange", onSelectionChange)
  }, [])

  const handleSend = () => {
    const content = htmlToMarkdown(html)
    if (!content.trim()) return
    onSend(content)
    setHtml("")
    setPlainText("")
    setActiveMentionQuery(null)
    if (editorRef.current) {
      editorRef.current.innerHTML = ""
    }
  }

  const handleInput = () => {
    const el = editorRef.current
    if (!el) return
    setHtml(el.innerHTML)
    setPlainText((el.textContent || "").replace(/\u00a0/g, " ").trim())
    setActiveMentionQuery(getMentionQuery(el))
  }

  const insertTextAtCursor = (text: string) => {
    focusEditor()
    exec("insertText", text)
    handleInput()
  }

  const applyCommand = (command: string, value?: string) => {
    focusEditor()
    const before = editorRef.current?.innerHTML || ""
    exec(command, value)
    handleInput()
    updateFormatState()
    const after = editorRef.current?.innerHTML || ""
    return before !== after
  }

  const toggleBlockFormat = (target: "blockquote" | "pre") => {
    focusEditor()
    const block = (document.queryCommandValue("formatBlock") || "")
      .toString()
      .toLowerCase()
      .replace(/[<>]/g, "")
    if (block === target) {
      exec("formatBlock", "div")
    } else {
      exec("formatBlock", `<${target}>`)
    }
    handleInput()
    updateFormatState()
  }

  const applyListWithFallback = (type: "ordered" | "unordered") => {
    const changed = applyCommand(
      type === "ordered" ? "insertOrderedList" : "insertUnorderedList"
    )
    if (!changed) {
      insertTextAtCursor(type === "ordered" ? "\n1. " : "\n- ")
    }
  }

  const applyQuoteWithFallback = () => {
    const before = editorRef.current?.innerHTML || ""
    toggleBlockFormat("blockquote")
    const after = editorRef.current?.innerHTML || ""
    if (before === after) {
      insertTextAtCursor("\n> ")
    }
  }

  const insertCodeBlock = () => {
    insertTextAtCursor("\n```\n\n```")
  }

  const keepSelection = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
  }

  const insertMention = (name: string) => {
    insertTextAtCursor(`@${name} `)
    setActiveMentionQuery(null)
  }

  return (
    <div className={compact ? "border-t p-2" : "border-t p-4"}>
      <div className="bg-muted/50 relative w-full rounded-xl border p-2">
        {!compact && (
          <div className="mb-2 flex items-center gap-1 border-b pb-2">
            <Button
              size="icon"
              variant="ghost"
              className={cn("h-8 w-8", formatState.bold && "border border-primary/40 bg-primary/10")}
              onMouseDown={keepSelection}
              onClick={() => applyCommand("bold")}
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={cn("h-8 w-8", formatState.italic && "border border-primary/40 bg-primary/10")}
              onMouseDown={keepSelection}
              onClick={() => applyCommand("italic")}
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={cn("h-8 w-8", formatState.underline && "border border-primary/40 bg-primary/10")}
              onMouseDown={keepSelection}
              onClick={() => applyCommand("underline")}
            >
              <Underline className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={cn("h-8 w-8", formatState.strikeThrough && "border border-primary/40 bg-primary/10")}
              onMouseDown={keepSelection}
              onClick={() => applyCommand("strikeThrough")}
            >
              <Strikethrough className="h-4 w-4" />
            </Button>
            <span className="mx-1 h-5 w-px bg-border" />
            <Button
              size="icon"
              variant="ghost"
              className={cn("h-8 w-8", formatState.orderedList && "border border-primary/40 bg-primary/10")}
              onMouseDown={keepSelection}
              onClick={() => applyListWithFallback("ordered")}
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={cn("h-8 w-8", formatState.unorderedList && "border border-primary/40 bg-primary/10")}
              onMouseDown={keepSelection}
              onClick={() => applyListWithFallback("unordered")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={cn("h-8 w-8", formatState.blockquote && "border border-primary/40 bg-primary/10")}
              onMouseDown={keepSelection}
              onClick={applyQuoteWithFallback}
            >
              <Quote className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={cn("h-8 w-8", formatState.code && "border border-primary/40 bg-primary/10")}
              onMouseDown={keepSelection}
              onClick={insertCodeBlock}
            >
              <Code2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="relative">
          <div
            ref={editorRef}
            contentEditable={!disabled}
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            className={cn(
              "max-h-40 w-full overflow-y-auto whitespace-pre-wrap break-words rounded bg-transparent py-1 outline-none",
              compact ? "min-h-[24px] text-sm" : "min-h-[36px] text-base",
              disabled && "pointer-events-none opacity-60"
            )}
            data-placeholder={placeholder}
          />

          {!plainText && (
            <div className={cn("pointer-events-none absolute top-1 left-0 text-muted-foreground", compact ? "text-sm" : "text-base")}>
              {placeholder}
            </div>
          )}

          {activeMentionQuery != null && filteredMentionUsers.length > 0 && (
            <div className="absolute bottom-full left-0 z-20 mb-2 max-h-56 w-64 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
              {filteredMentionUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertMention(user.name)}
                  className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
                >
                  @{user.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={cn("mt-2 flex items-center gap-1 border-t pt-2", compact && "mt-1")}>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8">
                <Smile className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto border-0 bg-transparent p-0">
              <EmojiPicker
                onEmojiClick={({ emoji }) => {
                  insertTextAtCursor(emoji)
                }}
              />
            </PopoverContent>
          </Popover>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => insertTextAtCursor("@")}
          >
            <AtSign className="h-4 w-4" />
          </Button>
          <span className="mx-1 h-5 w-px bg-border" />
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => insertTextAtCursor("/")}
          >
            <Slash className="h-4 w-4" />
          </Button>
          <div className="ml-auto">
            <Button
              size="icon"
              className="h-8 w-8"
              onClick={handleSend}
              disabled={!plainText || disabled}
            >
              <SendHorizonal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
