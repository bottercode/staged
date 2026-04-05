import { useState, useRef, useEffect, useCallback } from "react"
import type { AgentEvent } from "../../main/agent"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  toolCalls?: { id: string; name: string; input: unknown; output?: string }[]
  isStreaming?: boolean
  isError?: boolean
}

let idCounter = 0
const uid = () => `msg-${Date.now()}-${++idCounter}`

export function ChatPanel({ cwd }: { cwd: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isRunning, setIsRunning] = useState(false)
  const [permissionMode, setPermissionMode] = useState<"edit" | "plan">("edit")
  const historyRef = useRef<unknown[]>([])
  const activeJobRef = useRef<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`
  }, [input])

  const handleAgentEvent = useCallback(
    (jobId: string, event: AgentEvent) => {
      if (jobId !== activeJobRef.current) return

      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (!last || last.role !== "assistant") return prev

        if (event.type === "text") {
          return [
            ...prev.slice(0, -1),
            { ...last, content: event.text, isStreaming: true },
          ]
        }

        if (event.type === "tool-call") {
          const existing = last.toolCalls ?? []
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              toolCalls: [
                ...existing,
                { id: event.id, name: event.name, input: event.input },
              ],
            },
          ]
        }

        if (event.type === "tool-result") {
          const updated = (last.toolCalls ?? []).map((tc) =>
            tc.id === event.id ? { ...tc, output: event.output } : tc
          )
          return [
            ...prev.slice(0, -1),
            { ...last, toolCalls: updated },
          ]
        }

        if (event.type === "done") {
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              content: event.finalText || last.content,
              isStreaming: false,
            },
          ]
        }

        if (event.type === "error") {
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              content: event.message,
              isStreaming: false,
              isError: true,
            },
          ]
        }

        return prev
      })

      if (event.type === "done" || event.type === "error") {
        setIsRunning(false)
        activeJobRef.current = null
      }
    },
    []
  )

  useEffect(() => {
    const off = window.api.onAgentEvent(handleAgentEvent)
    return off
  }, [handleAgentEvent])

  const send = async () => {
    const prompt = input.trim()
    if (!prompt || isRunning) return

    setInput("")
    setIsRunning(true)

    const userMsg: Message = { id: uid(), role: "user", content: prompt }
    const assistantMsg: Message = {
      id: uid(),
      role: "assistant",
      content: "",
      toolCalls: [],
      isStreaming: true,
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])

    const jobId = uid()
    activeJobRef.current = jobId

    await window.api.runAgent({
      jobId,
      prompt,
      cwd,
      permissionMode,
      history: historyRef.current,
    })
  }

  const stop = () => {
    if (activeJobRef.current) {
      window.api.stopAgent(activeJobRef.current)
      activeJobRef.current = null
      setIsRunning(false)
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.isStreaming)
          return [...prev.slice(0, -1), { ...last, isStreaming: false }]
        return prev
      })
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center space-y-2">
              <p className="text-[13px] text-white/30">
                Ask anything about your codebase
              </p>
              <p className="text-[11px] text-white/20 font-mono">{cwd}</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-white/[0.06] p-3">
        <div className="flex items-end gap-2">
          {/* Mode toggle */}
          <button
            onClick={() =>
              setPermissionMode((m) => (m === "edit" ? "plan" : "edit"))
            }
            className={`shrink-0 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
              permissionMode === "plan"
                ? "bg-amber-500/20 text-amber-400"
                : "bg-white/[0.06] text-white/40 hover:text-white/60"
            }`}
            title="Toggle plan mode"
          >
            {permissionMode === "plan" ? "Plan" : "Edit"}
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            placeholder="Ask anything... (Enter to send, Shift+Enter for newline)"
            rows={1}
            className="selectable flex-1 resize-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[13px] text-white/90 placeholder-white/25 focus:border-white/20 focus:outline-none transition-colors"
          />

          {isRunning ? (
            <button
              onClick={stop}
              className="shrink-0 rounded-lg bg-red-500/20 px-3 py-2 text-[13px] font-medium text-red-400 hover:bg-red-500/30 transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={() => void send()}
              disabled={!input.trim()}
              className="shrink-0 rounded-lg bg-white/90 px-3 py-2 text-[13px] font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-30"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user"

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-xl px-3.5 py-2.5 ${
          isUser
            ? "bg-white/90 text-black"
            : message.isError
              ? "bg-red-500/10 text-red-400"
              : "bg-white/[0.06] text-white/85"
        }`}
      >
        {/* Text content */}
        {message.content && (
          <p className="selectable whitespace-pre-wrap text-[13px] leading-relaxed">
            {message.content}
            {message.isStreaming && !message.content && (
              <span className="inline-block h-3.5 w-0.5 animate-pulse bg-current opacity-70 ml-0.5" />
            )}
          </p>
        )}

        {/* Streaming cursor when no text yet */}
        {message.isStreaming && !message.content && (message.toolCalls ?? []).length === 0 && (
          <span className="inline-block h-3.5 w-0.5 animate-pulse bg-current opacity-70" />
        )}

        {/* Tool calls */}
        {(message.toolCalls ?? []).length > 0 && (
          <div className="mt-2 space-y-1.5">
            {(message.toolCalls ?? []).map((tc) => (
              <ToolCallItem key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ToolCallItem({
  toolCall,
}: {
  toolCall: { id: string; name: string; input: unknown; output?: string }
}) {
  const [expanded, setExpanded] = useState(false)
  const isDone = toolCall.output !== undefined

  return (
    <div className="rounded-lg border border-white/[0.08] bg-black/30 overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${
            isDone ? "bg-green-400" : "bg-amber-400 animate-pulse"
          }`}
        />
        <span className="font-mono text-[11px] text-white/60">{toolCall.name}</span>
        <span className="ml-auto text-[10px] text-white/25">
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.06] px-3 py-2 space-y-1.5">
          <div>
            <p className="text-[10px] font-medium text-white/30 uppercase mb-1">Input</p>
            <pre className="selectable whitespace-pre-wrap break-all font-mono text-[11px] text-white/50 leading-relaxed">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>
          {toolCall.output !== undefined && (
            <div>
              <p className="text-[10px] font-medium text-white/30 uppercase mb-1">Output</p>
              <pre className="selectable whitespace-pre-wrap break-all font-mono text-[11px] text-white/50 leading-relaxed max-h-48 overflow-y-auto">
                {toolCall.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
