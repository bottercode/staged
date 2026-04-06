import { useState, useRef, useEffect, useCallback } from "react"
import type { AgentEvent } from "../../main/agent"
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  FileCode,
  Terminal as TerminalIcon,
  Search,
  FolderOpen,
  PenLine,
  X,
  GitBranch,
  ArrowRight,
  Sparkles,
  Plus,
} from "lucide-react"
import logo from "../assets/logo.png"

// ── Types ─────────────────────────────────────────────────

type ToolCall = {
  id: string
  name: string
  input: unknown
  output?: string
}

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  toolCalls: ToolCall[]
  isStreaming: boolean
  isError: boolean
}

let _idCounter = 0
function uid() {
  return `msg-${Date.now()}-${++_idCounter}`
}

// ── Spinner verbs (matching webapp) ──────────────────────

const SPINNER_VERBS = [
  "Basting", "Bubbling", "Calibrating", "Clarifying", "Conjuring",
  "Decanting", "Decoding", "Decocting", "Distilling", "Enkindling",
  "Extrapolating", "Fiddling", "Fomenting", "Frying", "Galvanizing",
  "Glazing", "Grating", "Interpolating", "Invoking", "Juggling",
  "Macerating", "Mashing", "Poaching", "Rendering", "Roasting",
  "Scaffolding", "Sculpting", "Sizzling", "Smelting", "Stirring",
  "Stitching", "Torching", "Unspooling", "Weaving", "Welding", "Zapping",
]

const FINISHED_VERBS = [
  "Basted", "Bubbled", "Calibrated", "Clarified", "Conjured", "Decanted",
  "Decoded", "Decocted", "Distilled", "Enkindled", "Extrapolated", "Fiddled",
  "Fomented", "Fried", "Galvanized", "Glazed", "Grated", "Interpolated",
  "Invoked", "Juggled", "Macerated", "Mashed", "Poached", "Rendered",
  "Roasted", "Scaffolded", "Sculpted", "Sizzled", "Smelted", "Stirred",
  "Stitched", "Torched", "Unspooled", "Woven", "Welded", "Zapped",
]

// ── Tool display helpers ──────────────────────────────────

const TOOL_ICONS: Record<string, React.ReactNode> = {
  Read: <FileCode className="h-3.5 w-3.5" />,
  Write: <PenLine className="h-3.5 w-3.5" />,
  Edit: <PenLine className="h-3.5 w-3.5" />,
  Bash: <TerminalIcon className="h-3.5 w-3.5" />,
  Glob: <FolderOpen className="h-3.5 w-3.5" />,
  Grep: <Search className="h-3.5 w-3.5" />,
  LS: <FolderOpen className="h-3.5 w-3.5" />,
}

function getToolSummary(toolName: string, input: Record<string, unknown>): string {
  if (!input) return ""
  switch (toolName) {
    case "Read":
    case "Write":
    case "Edit":
      return input.file_path ? String(input.file_path) : ""
    case "Bash":
      return input.command
        ? String(input.command).slice(0, 80) + (String(input.command).length > 80 ? "..." : "")
        : ""
    case "Glob":
      return input.pattern ? String(input.pattern) : ""
    case "Grep":
      return input.pattern ? `"${input.pattern}"` : ""
    default:
      return ""
  }
}

// ── Tool call block (collapsible) ─────────────────────────

function ToolCallBlock({
  toolName,
  input,
  output,
  running,
}: {
  toolName: string
  input: unknown
  output?: string
  running: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  const summary =
    input && typeof input === "object"
      ? getToolSummary(toolName, input as Record<string, unknown>)
      : ""

  return (
    <div className="my-1 font-mono text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="group flex w-full items-center gap-1.5 rounded px-2 py-1 text-left transition-colors hover:bg-muted/50"
      >
        {running ? (
          <span className="h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-primary" />
        ) : (
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-green-500" />
        )}
        <span className="text-muted-foreground">
          {TOOL_ICONS[toolName] ?? <TerminalIcon className="h-3.5 w-3.5" />}
        </span>
        <span className="text-muted-foreground">{toolName}</span>
        {summary && (
          <span className="truncate text-foreground/70">{summary}</span>
        )}
        <span className="ml-auto opacity-0 transition-opacity group-hover:opacity-100">
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
        </span>
      </button>

      {expanded && (
        <div className="mt-1 ml-5 space-y-1.5 border-l-2 border-border pb-1 pl-3">
          {input != null && (
            <pre className="max-h-48 overflow-auto rounded bg-muted p-2 text-[11px] break-all whitespace-pre-wrap text-muted-foreground select-text">
              {JSON.stringify(input, null, 2)}
            </pre>
          )}
          {output !== undefined && (
            <pre className="max-h-48 overflow-auto rounded bg-muted p-2 text-[11px] break-all whitespace-pre-wrap text-muted-foreground select-text">
              {output}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

// ── Model selector ────────────────────────────────────────

const MODELS = [
  { id: "anthropic:claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "Anthropic" },
  { id: "anthropic:claude-opus-4-6", label: "Claude Opus 4.6", provider: "Anthropic" },
  { id: "anthropic:claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "Anthropic" },
  { id: "anthropic:claude-sonnet-4-5-20251001", label: "Claude Sonnet 4.5", provider: "Anthropic" },
  { id: "openai:gpt-4o", label: "GPT-4o", provider: "OpenAI" },
  { id: "openai:gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI" },
  { id: "openai:o4-mini", label: "o4-mini", provider: "OpenAI" },
  { id: "google:gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "Google" },
  { id: "google:gemini-2.0-flash-001", label: "Gemini 2.0 Flash", provider: "Google" },
  { id: "xai:grok-3-mini-fast-beta", label: "Grok 3 Mini", provider: "xAI" },
]

function ModelSelector({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = MODELS.find((m) => m.id === value)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const grouped = MODELS.reduce(
    (acc, m) => {
      ;(acc[m.provider] ??= []).push(m)
      return acc
    },
    {} as Record<string, typeof MODELS>
  )

  const displayLabel = current
    ? current.label
    : value.split(":").slice(1).join(":") || value

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {displayLabel}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-56 rounded-lg border bg-popover p-1 shadow-lg">
          {Object.entries(grouped).map(([provider, models]) => (
            <div key={provider}>
              <p className="px-2 pt-2 pb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                {provider}
              </p>
              {models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { onChange(m.id); setOpen(false) }}
                  className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted ${
                    m.id === value ? "font-medium text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {m.label}
                  {m.id === value && (
                    <span className="ml-auto">
                      <ChevronRight className="h-3 w-3 text-primary" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Markdown formatter ────────────────────────────────────

function formatMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /```(\w*)\n([\s\S]*?)```/g,
      '<pre class="rounded border bg-muted p-3 text-xs overflow-x-auto my-2 font-mono select-text"><code>$2</code></pre>'
    )
    .replace(
      /`([^`]+)`/g,
      '<code class="rounded bg-muted border px-1.5 py-0.5 text-xs font-mono">$1</code>'
    )
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>")
}

// ── Main ChatPanel ────────────────────────────────────────

export function ChatPanel({
  cwd,
  sessionId,
  history,
  onHistoryUpdate,
  onDisconnect,
  onSwitchRepo,
}: {
  cwd: string
  sessionId: string
  history: unknown[]
  onHistoryUpdate: (h: unknown[]) => void
  onDisconnect: () => void
  onSwitchRepo: () => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isRunning, setIsRunning] = useState(false)
  const [permissionMode, setPermissionMode] = useState<"edit" | "plan">("edit")
  const [modelId, setModelId] = useState("anthropic:claude-sonnet-4-5-20251001")
  const [gitBranch, setGitBranch] = useState<string | null>(null)
  const [isGit, setIsGit] = useState(false)
  const [pastedImage, setPastedImage] = useState<string | null>(null)
  const [loadingVerb, setLoadingVerb] = useState(() => SPINNER_VERBS[0])
  const [responseStats, setResponseStats] = useState<{
    startTime: number | null
    endTime: number | null
    finishedVerb: string | null
  }>({ startTime: null, endTime: null, finishedVerb: null })

  const historyRef = useRef<unknown[]>(history)
  const activeJobRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load settings on mount
  useEffect(() => {
    window.api.getSettings().then((s) => setModelId(s.modelId)).catch(() => {})
  }, [])

  // Load git branch
  useEffect(() => {
    let disposed = false
    const load = async () => {
      try {
        const res = await window.api.getGitBranch(cwd)
        if (!disposed) {
          setIsGit(res.isGit)
          setGitBranch(res.isGit ? res.branch : null)
        }
      } catch {
        if (!disposed) { setIsGit(false); setGitBranch(null) }
      }
    }
    load()
    const iv = window.setInterval(load, 5000)
    return () => { disposed = true; window.clearInterval(iv) }
  }, [cwd])

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus input when session changes
  useEffect(() => {
    inputRef.current?.focus()
  }, [sessionId])

  // Reset messages when session changes
  useEffect(() => {
    setMessages([])
    setInput("")
    setResponseStats({ startTime: null, endTime: null, finishedVerb: null })
    historyRef.current = history
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Loading verb cycling
  useEffect(() => {
    if (!isRunning) {
      setResponseStats((prev) => {
        if (!prev.startTime || prev.endTime) return prev
        const idx = Math.floor(Math.random() * FINISHED_VERBS.length)
        return { ...prev, endTime: Date.now(), finishedVerb: FINISHED_VERBS[idx] }
      })
      return
    }
    setResponseStats((prev) => ({
      ...prev,
      startTime: prev.startTime || Date.now(),
      endTime: null,
      finishedVerb: null,
    }))
    setLoadingVerb(SPINNER_VERBS[Math.floor(Math.random() * SPINNER_VERBS.length)])
    const iv = setInterval(() => {
      setLoadingVerb(SPINNER_VERBS[Math.floor(Math.random() * SPINNER_VERBS.length)])
    }, 3000)
    return () => clearInterval(iv)
  }, [isRunning])

  // Agent events
  const handleAgentEvent = useCallback(
    (jobId: string, event: AgentEvent) => {
      if (jobId !== activeJobRef.current) return

      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (!last || last.role !== "assistant") return prev

        if (event.type === "text") {
          return [...prev.slice(0, -1), { ...last, content: event.text, isStreaming: true }]
        }
        if (event.type === "tool-call") {
          return [
            ...prev.slice(0, -1),
            { ...last, toolCalls: [...last.toolCalls, { id: event.id, name: event.name, input: event.input }] },
          ]
        }
        if (event.type === "tool-result") {
          const updated = last.toolCalls.map((tc) =>
            tc.id === event.id ? { ...tc, output: event.output } : tc
          )
          return [...prev.slice(0, -1), { ...last, toolCalls: updated }]
        }
        if (event.type === "done") {
          return [
            ...prev.slice(0, -1),
            { ...last, content: event.finalText || last.content, isStreaming: false },
          ]
        }
        if (event.type === "error") {
          return [
            ...prev.slice(0, -1),
            { ...last, content: event.message, isStreaming: false, isError: true },
          ]
        }
        return prev
      })

      if (event.type === "done" || event.type === "error") {
        setIsRunning(false)
        activeJobRef.current = null
        onHistoryUpdate(historyRef.current)
      }
    },
    [onHistoryUpdate]
  )

  useEffect(() => {
    return window.api.onAgentEvent(handleAgentEvent)
  }, [handleAgentEvent])

  const send = async () => {
    const prompt = input.trim()
    if ((!prompt && !pastedImage) || isRunning) return

    setInput("")
    setPastedImage(null)
    setIsRunning(true)
    setResponseStats({ startTime: null, endTime: null, finishedVerb: null })

    const userMsg: Message = {
      id: uid(),
      role: "user",
      content: prompt,
      toolCalls: [],
      isStreaming: false,
      isError: false,
    }
    const assistantMsg: Message = {
      id: uid(),
      role: "assistant",
      content: "",
      toolCalls: [],
      isStreaming: true,
      isError: false,
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
      modelId,
    })
  }

  const stop = () => {
    if (activeJobRef.current) {
      window.api.stopAgent(activeJobRef.current)
      activeJobRef.current = null
      setIsRunning(false)
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.isStreaming) return [...prev.slice(0, -1), { ...last, isStreaming: false }]
        return prev
      })
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile()
        if (file) {
          const reader = new FileReader()
          reader.onload = (ev) => {
            if (ev.target?.result) setPastedImage(ev.target.result as string)
          }
          reader.readAsDataURL(file)
          e.preventDefault()
          return
        }
      }
    }
  }

  const projectName = cwd.split("/").pop() || cwd

  return (
    <div className="flex h-full w-full flex-col bg-background">
      {/* Header bar */}
      <div className="flex h-11 items-center gap-2 border-b bg-muted/30 px-4">
        <span className="text-sm font-medium text-foreground">Staged AI</span>
        <span className="text-border">|</span>
        <FolderOpen className="h-3 w-3 text-muted-foreground" />
        <code className="max-w-[200px] truncate text-xs text-muted-foreground">
          {projectName}
        </code>

        {isGit && (
          <div className="flex items-center gap-1">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
              <GitBranch className="h-3 w-3" />
              <span className="text-[9px] tracking-wide uppercase opacity-80">Branch</span>
            </span>
            {gitBranch && (
              <code className="max-w-[140px] truncate rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                {gitBranch}
              </code>
            )}
          </div>
        )}

        <span className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {MODELS.find((m) => m.id === modelId)?.label ?? modelId.split(":").slice(1).join(":")}
        </span>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={onSwitchRepo}
            className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Switch project"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Switch Repo
          </button>
          <button
            onClick={onDisconnect}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Disconnect"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="space-y-3 p-4 text-sm">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24">
              <img src={logo} alt="Staged" className="mb-4 h-12 w-12 rounded-2xl" />
              <p className="text-lg font-semibold text-foreground">What should we build?</p>
              <p className="mt-1 text-xs text-muted-foreground">{projectName}</p>
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                {[
                  "What does this project do?",
                  "Run the tests",
                  "Find all TODO comments",
                  "Refactor this codebase",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); inputRef.current?.focus() }}
                    className="rounded-full border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => {
            if (msg.role === "user") {
              return (
                <div
                  key={msg.id}
                  className="flex items-start gap-2 rounded-lg border bg-muted p-3"
                >
                  <span className="flex-shrink-0 font-bold text-primary">&gt;</span>
                  <div className="flex flex-col gap-2">
                    <span className="select-text whitespace-pre-wrap text-foreground">
                      {msg.content}
                    </span>
                    {pastedImage && msg === messages[messages.length - 2] && (
                      <img src={pastedImage} alt="User image" className="max-h-64 rounded-lg" />
                    )}
                  </div>
                </div>
              )
            }

            // Assistant message
            return (
              <div key={msg.id} className="space-y-1 font-mono">
                {msg.toolCalls.map((tc) => (
                  <ToolCallBlock
                    key={tc.id}
                    toolName={tc.name}
                    input={tc.input}
                    output={tc.output}
                    running={tc.output === undefined && msg.isStreaming}
                  />
                ))}
                {msg.content.trim() && !msg.isError && (
                  <div
                    className="select-text pl-0 font-sans text-sm leading-relaxed whitespace-pre-wrap text-foreground/90"
                    dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
                  />
                )}
                {msg.isError && (
                  <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 font-sans text-sm text-red-400 select-text">
                    {msg.content}
                  </div>
                )}
                {msg.isStreaming && !msg.content && msg.toolCalls.length === 0 && (
                  <span className="inline-block h-3.5 w-0.5 animate-pulse bg-current opacity-70" />
                )}
              </div>
            )
          })}

          {isRunning ? (
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin text-primary/70" />
              <span className="font-mono text-primary/70">{loadingVerb}...</span>
            </div>
          ) : responseStats.endTime && responseStats.startTime && messages.length > 0 ? (
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-green-500/80" />
              <span className="font-mono text-green-400/80">
                {responseStats.finishedVerb}! (
                {((responseStats.endTime - responseStats.startTime) / 1000).toFixed(1)}s)
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Input bar */}
      <div className="px-4 pb-4">
        <div className="rounded-2xl border bg-muted/30">
          <div className="px-4 pt-3 pb-1">
            {pastedImage && (
              <div className="relative mb-2 h-24 w-24 rounded-md border">
                <img
                  src={pastedImage}
                  alt="Pasted"
                  className="h-full w-full rounded-md object-cover"
                />
                <button
                  onClick={() => setPastedImage(null)}
                  className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
              onPaste={handlePaste}
              placeholder="Ask Staged AI anything..."
              rows={1}
              className="max-h-32 w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none select-text"
              style={{ height: "auto", minHeight: "1.5rem" }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement
                t.style.height = "auto"
                t.style.height = Math.min(t.scrollHeight, 128) + "px"
              }}
            />
          </div>
          <div className="flex items-center gap-1 px-3 pb-3">
            <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Plus className="h-4 w-4" />
            </button>
            <ModelSelector value={modelId} onChange={setModelId} />
            <select
              value={permissionMode}
              onChange={(e) => setPermissionMode(e.target.value as "edit" | "plan")}
              className="h-7 rounded-md border bg-background px-2 text-xs text-muted-foreground"
              title="Permission mode"
            >
              <option value="plan">Plan</option>
              <option value="edit">Edit</option>
            </select>
            <div className="ml-auto">
              <button
                type="button"
                disabled={!isRunning && !input.trim() && !pastedImage}
                onClick={isRunning ? stop : () => void send()}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
                title={isRunning ? "Stop" : "Send"}
              >
                {isRunning ? <X className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
