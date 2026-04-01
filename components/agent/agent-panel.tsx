"use client"

import { SessionTabs, type Session } from "./session-tabs"
import { useChat } from "@ai-sdk/react"
import { type UIMessage } from "ai"
import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import {
  Loader2,
  ChevronDown,
  ChevronLeft,
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
  Zap,
  FileText,
  Code2,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { BridgeTransport } from "@/lib/agent/transport"
import {
  readAgentSettings,
  writeAgentSettings,
  type AgentProviderApiKeys,
} from "@/lib/agent-settings"

// ── Types ────────────────────────────────────────────────

type ProjectInfo = {
  valid: boolean
  name: string
  path: string
  fileCount: number
  projectType: string
  isGit: boolean
  files: string[]
  error?: string
}

type AgentSession = Session & {
  conversationId: string
  messages: UIMessage[]
  tag?: string | null
}

type AgentMessagePart = {
  type?: string
  text?: string
  toolCallId?: string
  input?: unknown
  output?: unknown
  state?: string
  toolInvocation?: {
    toolName?: string
    args?: unknown
    input?: unknown
    result?: unknown
    output?: unknown
    state?: string
  }
  data?: unknown
  errorText?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

let fallbackSessionIdCounter = 0
function createClientId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID()
  }
  fallbackSessionIdCounter += 1
  return `session-${fallbackSessionIdCounter}`
}

// ── Tool display helpers ─────────────────────────────────

const TOOL_ICONS: Record<string, React.ReactNode> = {
  Read: <FileCode className="h-3.5 w-3.5" />,
  Write: <PenLine className="h-3.5 w-3.5" />,
  Edit: <PenLine className="h-3.5 w-3.5" />,
  Bash: <TerminalIcon className="h-3.5 w-3.5" />,
  Glob: <FolderOpen className="h-3.5 w-3.5" />,
  Grep: <Search className="h-3.5 w-3.5" />,
  WebFetch: <Search className="h-3.5 w-3.5" />,
  WebSearch: <Search className="h-3.5 w-3.5" />,
  NotebookEdit: <FileCode className="h-3.5 w-3.5" />,
}

const TOOL_LABELS: Record<string, string> = {
  Read: "Read",
  Write: "Write",
  Edit: "Edit",
  Bash: "Bash",
  Glob: "Glob",
  Grep: "Grep",
  WebFetch: "WebFetch",
  WebSearch: "WebSearch",
  NotebookEdit: "NotebookEdit",
}

const PROJECT_TYPE_LABELS: Record<string, string> = {
  node: "Node.js",
  go: "Go",
  rust: "Rust",
  python: "Python",
  java: "Java",
  unknown: "Project",
}

function getToolSummary(
  toolName: string,
  input: Record<string, unknown>
): string {
  if (!input) return ""
  switch (toolName) {
    case "Read":
    case "Write":
    case "Edit":
      return input.file_path ? String(input.file_path) : ""
    case "Bash":
      return input.command
        ? String(input.command).slice(0, 80) +
            (String(input.command).length > 80 ? "..." : "")
        : ""
    case "Glob":
      return input.pattern ? String(input.pattern) : ""
    case "Grep":
      return input.pattern ? `"${input.pattern}"` : ""
    case "WebFetch":
      return input.url ? String(input.url).slice(0, 60) : ""
    case "WebSearch":
      return input.query ? `"${input.query}"` : ""
    case "NotebookEdit":
      return input.notebook_path ? String(input.notebook_path) : ""
    default:
      return ""
  }
}

// ── Tool call block (collapsible) ────────────────────────

function ToolCallBlock({
  toolName,
  input,
  output,
  state,
}: {
  toolName: string
  input: unknown
  output: unknown
  state: string
}) {
  const [expanded, setExpanded] = useState(false)
  const isRunning =
    state === "call" ||
    state === "partial-call" ||
    state === "input-streaming" ||
    state === "input-available"
  const hasError = output && typeof output === "object" && "error" in output

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
        {isRunning ? (
          <span className="h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-primary" />
        ) : hasError ? (
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-destructive" />
        ) : (
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-green-500" />
        )}
        <span className="text-muted-foreground">
          {TOOL_ICONS[toolName] ?? <TerminalIcon className="h-3.5 w-3.5" />}
        </span>
        <span className="text-muted-foreground">
          {TOOL_LABELS[toolName] ?? toolName}
        </span>
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
            <pre className="max-h-48 overflow-auto rounded bg-muted p-2 text-[11px] break-all whitespace-pre-wrap text-muted-foreground">
              {JSON.stringify(input, null, 2)}
            </pre>
          )}
          {output !== undefined && (
            <pre
              className={cn(
                "max-h-48 overflow-auto rounded p-2 text-[11px] break-all whitespace-pre-wrap",
                hasError
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {typeof output === "string"
                ? output
                : JSON.stringify(output, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

function AgentEventBlock({ event }: { event: Record<string, unknown> }) {
  const type = typeof event.type === "string" ? event.type : "event"
  const subtype = typeof event.subtype === "string" ? event.subtype : ""
  const label = subtype ? `${type}.${subtype}` : type

  return (
    <div className="my-1 font-mono text-xs">
      <details className="rounded border bg-muted/30 px-2 py-1">
        <summary className="cursor-pointer text-muted-foreground">
          Agent: {label}
        </summary>
        <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-2 text-[11px] break-all whitespace-pre-wrap text-muted-foreground">
          {JSON.stringify(event, null, 2)}
        </pre>
      </details>
    </div>
  )
}

function AgentStatusBlock({ status }: { status: string }) {
  return (
    <div className="my-1 pl-1 font-mono text-[11px] text-muted-foreground">
      Agent status: {status}
    </div>
  )
}

function AgentThinkingBlock({ text }: { text: string }) {
  return (
    <details className="my-1 rounded border border-border/60 bg-muted/20 px-2 py-1">
      <summary className="cursor-pointer text-[11px] text-muted-foreground">
        Agent reasoning
      </summary>
      <div className="mt-2 font-mono text-[11px] whitespace-pre-wrap text-muted-foreground">
        {text}
      </div>
    </details>
  )
}

// ── Recent folders helpers ───────────────────────────────

const RECENT_KEY = "staged-agent-recent"

function getRecentFolders(): string[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]")
  } catch {
    return []
  }
}

function addRecentFolder(path: string) {
  const recent = getRecentFolders().filter((p) => p !== path)
  recent.unshift(path)
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 5)))
}

function removeRecentFolder(path: string) {
  const recent = getRecentFolders().filter((p) => p !== path)
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent))
}

const AGENT_STATE_KEY = "staged-agent-state-v1"

type PersistedAgentSession = Session & {
  conversationId: string
  messages: UIMessage[]
}

type PersistedAgentState = {
  projectPath: string | null
  projectInfo: ProjectInfo | null
  modelId: string
  sessions: PersistedAgentSession[]
  currentSessionId: string
}

function readPersistedAgentState(): PersistedAgentState | null {
  if (typeof window === "undefined") return null

  try {
    const raw = localStorage.getItem(AGENT_STATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedAgentState
    if (
      !parsed ||
      !Array.isArray(parsed.sessions) ||
      !parsed.currentSessionId
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writePersistedAgentState(state: PersistedAgentState) {
  if (typeof window === "undefined") return
  localStorage.setItem(AGENT_STATE_KEY, JSON.stringify(state))
}

// ── Model list ───────────────────────────────────────────

const MODELS = [
  { id: "anthropic:sonnet", label: "Sonnet (Alias)", provider: "Anthropic" },
  { id: "anthropic:opus", label: "Opus (Alias)", provider: "Anthropic" },
  { id: "anthropic:haiku", label: "Haiku (Alias)", provider: "Anthropic" },
  {
    id: "anthropic:claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "Anthropic",
  },
  {
    id: "anthropic:claude-opus-4-6",
    label: "Claude Opus 4.6",
    provider: "Anthropic",
  },
  {
    id: "anthropic:claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    provider: "Anthropic",
  },
  { id: "openai:gpt-4o", label: "GPT-4o", provider: "OpenAI" },
  { id: "openai:gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI" },
  { id: "openai:gpt-4.1", label: "GPT-4.1", provider: "OpenAI" },
  { id: "openai:gpt-4.1-mini", label: "GPT-4.1 Mini", provider: "OpenAI" },
  { id: "openai:o3", label: "o3", provider: "OpenAI" },
  { id: "openai:o4-mini", label: "o4-mini", provider: "OpenAI" },
  { id: "google:gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "Google" },
  {
    id: "google:gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "Google",
  },
  {
    id: "google:gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    provider: "Google",
  },
  {
    id: "mistral:mistral-large-latest",
    label: "Mistral Large",
    provider: "Mistral",
  },
  { id: "mistral:codestral-latest", label: "Codestral", provider: "Mistral" },
  { id: "xai:grok-3", label: "Grok 3", provider: "xAI" },
  { id: "xai:grok-3-mini", label: "Grok 3 Mini", provider: "xAI" },
  { id: "__custom__", label: "Custom model ID...", provider: "Custom" },
]

function ModelSelector({
  value,
  onChange,
}: {
  value: string
  onChange: (id: string) => void
}) {
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {current ? current.label : `Custom: ${value}`}
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
                  onClick={() => {
                    if (m.id === "__custom__") {
                      const customId = window.prompt(
                        "Enter model as provider:model (e.g. google:gemini-2.5-pro)"
                      )
                      if (customId?.trim()) onChange(customId.trim())
                    } else {
                      onChange(m.id)
                    }
                    setOpen(false)
                  }}
                  className={cn(
                    "flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted",
                    m.id === value
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {m.label}
                  {m.id === value && (
                    <span className="ml-auto text-primary">
                      <ChevronRight className="h-3 w-3" />
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

// ── Suggestion cards ─────────────────────────────────────

const SUGGESTIONS = [
  {
    icon: <Zap className="h-4 w-4" />,
    title: "Build a feature",
    desc: "Scaffold components, write logic, wire up APIs",
  },
  {
    icon: <FileText className="h-4 w-4" />,
    title: "Fix a bug",
    desc: "Debug issues, trace errors, apply targeted fixes",
  },
  {
    icon: <Code2 className="h-4 w-4" />,
    title: "Explore codebase",
    desc: "Understand architecture, find patterns, read code",
  },
]

// ── Folder browser dialog ────────────────────────────────

type BrowseData = {
  path: string
  name: string
  parent: string
  folders: string[]
  projectType: string | null
  isGit: boolean
  fileCount: number
}

function FolderBrowserDialog({
  open,
  onClose,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  onSelect: (path: string) => void
}) {
  const [browseData, setBrowseData] = useState<BrowseData | null>(null)
  const [loading, setLoading] = useState(false)
  const [pathInput, setPathInput] = useState("")

  const browse = useCallback(async (dirPath?: string) => {
    setLoading(true)
    try {
      const res = await fetch("/api/agent/browse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: dirPath }),
      })
      const data = await res.json()
      if (data.error) return
      setBrowseData(data)
      setPathInput(data.path)
    } catch {
      // ignore
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (open && !browseData) {
      void Promise.resolve().then(() => browse())
    }
  }, [open, browseData, browse])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex h-[520px] w-[640px] flex-col overflow-hidden rounded-xl border bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Open Project Folder</span>
          <button
            onClick={onClose}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Path bar */}
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <button
            onClick={() => browseData && browse(browseData.parent)}
            disabled={loading}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (pathInput.trim()) browse(pathInput.trim())
            }}
            className="flex-1"
          >
            <input
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              className="w-full rounded border bg-muted/50 px-3 py-1.5 font-mono text-xs text-foreground focus:border-primary/50 focus:outline-none"
            />
          </form>
        </div>

        {/* Folder list */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading && !browseData ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : browseData ? (
            <div className="space-y-0.5">
              {browseData.folders.map((folder) => (
                <button
                  key={folder}
                  onClick={() => browse(`${browseData.path}/${folder}`)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                    pathInput === `${browseData.path}/${folder}` &&
                      "bg-primary/10 text-primary"
                  )}
                >
                  <FolderOpen className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <span className="truncate">{folder}</span>
                  <ChevronRight className="ml-auto h-3 w-3 text-muted-foreground/50" />
                </button>
              ))}
              {browseData.folders.length === 0 && (
                <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                  No subfolders
                </p>
              )}
            </div>
          ) : null}
        </div>

        {/* Current folder info + actions */}
        <div className="flex items-center justify-between border-t px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {browseData && (
              <>
                <span className="font-medium text-foreground">
                  {browseData.name}
                </span>
                {browseData.projectType && (
                  <span className="rounded border bg-muted px-1.5 py-0.5 text-[10px]">
                    {PROJECT_TYPE_LABELS[browseData.projectType] ??
                      browseData.projectType}
                  </span>
                )}
                {browseData.isGit && (
                  <span className="flex items-center gap-0.5">
                    <GitBranch className="h-3 w-3" /> git
                  </span>
                )}
                <span>{browseData.fileCount} items</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const selected = pathInput.trim() || browseData?.path
                if (selected) onSelect(selected)
              }}
              disabled={loading}
            >
              Open
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Connect screen ───────────────────────────────────────

function ConnectScreen({
  onConnect,
  modelId,
  onModelChange,
}: {
  onConnect: (path: string, info: ProjectInfo) => void
  modelId: string
  onModelChange: (id: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentFolders, setRecentFolders] = useState<string[]>([])
  const [showBrowser, setShowBrowser] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    setRecentFolders(getRecentFolders())
  }, [])

  const connect = async (dirPath: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/agent/validate-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: dirPath }),
      })
      const data: ProjectInfo = await res.json()
      if (!data.valid) {
        setError(data.error || "Invalid directory")
        setLoading(false)
        return
      }
      addRecentFolder(data.path)
      onConnect(data.path, data)
    } catch {
      setError("Failed to validate path")
    }
    setLoading(false)
  }

  return (
    <div className="flex h-full w-full flex-col bg-background">
      {/* Center content */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 pb-32">
        {/* Icon */}
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border bg-muted">
          <Sparkles className="h-7 w-7 text-foreground/70" />
        </div>

        {/* Heading */}
        <h1 className="mb-3 text-2xl font-semibold tracking-tight text-foreground">
          Let&apos;s build
        </h1>

        {/* Connect button */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => setShowBrowser(true)}
            className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span>Connect a project folder</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>

          {error && <p className="text-xs text-destructive">{error}</p>}

          {/* Recent folders as quick-connect chips */}
          {isMounted && recentFolders.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {recentFolders.map((folder) => {
                const name = folder.split("/").pop() || folder
                return (
                  <button
                    key={folder}
                    onClick={() => connect(folder)}
                    disabled={loading}
                    className="group flex items-center gap-1.5 rounded-md border bg-muted/30 px-2.5 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <FolderOpen className="h-3 w-3" />
                    {name}
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeRecentFolder(folder)
                        setRecentFolders(getRecentFolders())
                      }}
                      className="ml-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                    >
                      <X className="h-2.5 w-2.5" />
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Suggestion cards */}
      <div className="px-6 pb-4">
        <div className="grid grid-cols-3 gap-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.title}
              onClick={() => setShowBrowser(true)}
              className="group rounded-xl border bg-card p-4 text-left transition-all hover:bg-accent"
            >
              <div className="mb-2 text-muted-foreground transition-colors group-hover:text-foreground">
                {s.icon}
              </div>
              <p className="text-sm font-medium text-foreground">{s.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom input bar — Codex style */}
      <div className="px-6 pb-4">
        <div className="rounded-2xl border bg-muted/30">
          <div className="px-4 pt-3 pb-2">
            <input
              type="text"
              placeholder="Ask Staged AI anything..."
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              disabled
            />
          </div>
          <div className="flex items-center gap-1 px-3 pb-3">
            <button
              onClick={() => setShowBrowser(true)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
            </button>
            <ModelSelector value={modelId} onChange={onModelChange} />
            <div className="ml-auto">
              <button
                disabled
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-40"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        <p className="mt-2 text-center text-[10px] text-muted-foreground/60">
          Connect a project folder to start coding
        </p>
      </div>

      {/* Folder browser dialog */}
      <FolderBrowserDialog
        open={showBrowser}
        onClose={() => setShowBrowser(false)}
        onSelect={(path) => {
          setShowBrowser(false)
          connect(path)
        }}
      />
    </div>
  )
}

// ── Main Agent Panel ─────────────────────────────────────

export function AgentPanel() {
  const createSession = (name: string): AgentSession => ({
    id: createClientId(),
    name,
    conversationId: createClientId(),
    messages: [],
    tag: null,
  })
  const [initialSession] = useState<AgentSession>(() => createSession("Chat 1"))

  const [projectPath, setProjectPath] = useState<string | null>(null)
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null)
  const [input, setInput] = useState("")
  const [pastedImage, setPastedImage] = useState<string | null>(null)
  const [modelId, setModelId] = useState("anthropic:sonnet")
  const [providerApiKeys, setProviderApiKeys] = useState<AgentProviderApiKeys>(
    {}
  )
  const [permissionMode, setPermissionMode] = useState<"edit" | "plan">("edit")
  const [gitBranch, setGitBranch] = useState<string | null>(null)
  const [runtimeStatus, setRuntimeStatus] = useState<string | null>(null)
  const [estimatedCostUsd, setEstimatedCostUsd] = useState<number | null>(null)
  const [sessionEditDialog, setSessionEditDialog] = useState<{
    open: boolean
    mode: "rename" | "tag"
    sessionId: string | null
    value: string
  }>({ open: false, mode: "rename", sessionId: null, value: "" })

  const [sessions, setSessions] = useState<AgentSession[]>(() => [
    initialSession,
  ])
  const [currentSessionId, setCurrentSessionId] = useState<string>(
    initialSession.id
  )
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const hydratingSessionRef = useRef(false)
  const hydratedFromStorageRef = useRef(false)

  const activeSession = useMemo(
    () =>
      sessions.find((session) => session.id === currentSessionId) ??
      sessions[0],
    [sessions, currentSessionId]
  )

  const activeConversationId = activeSession?.conversationId ?? ""

  const transport = useMemo(
    () =>
      activeConversationId
        ? new BridgeTransport({
            api: "/api/agent",
            conversationId: activeConversationId,
          })
        : undefined,
    [activeConversationId]
  )

  const { messages, sendMessage, stop, status, setMessages } = useChat({
    id: activeConversationId || undefined,
    transport,
  })

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([])
    }
  }, [activeConversationId, setMessages])
  const isLoading = status === "streaming" || status === "submitted"

  // Load session messages when switching tabs
  useEffect(() => {
    if (!activeSession) return
    hydratingSessionRef.current = true
    setMessages(activeSession.messages)
    const timeout = window.setTimeout(() => {
      hydratingSessionRef.current = false
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [activeSession, setMessages])

  // Persist current chat transcript into active session
  useEffect(() => {
    if (!activeSession || hydratingSessionRef.current) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessions((prev) =>
      prev.map((session) =>
        session.id === activeSession.id ? { ...session, messages } : session
      )
    )
  }, [messages, activeSession])

  const handleNewSession = () => {
    const newSession = createSession(`Chat ${sessions.length + 1}`)
    setSessions((prev) =>
      prev
        .map((session) =>
          session.id === currentSessionId ? { ...session, messages } : session
        )
        .concat(newSession)
    )
    setCurrentSessionId(newSession.id)
    setInput("")
  }

  const handleSessionSelect = (id: string) => {
    if (id === currentSessionId) return
    setSessions((prev) =>
      prev.map((session) =>
        session.id === currentSessionId ? { ...session, messages } : session
      )
    )
    setCurrentSessionId(id)
    setInput("")
  }

  const handleSessionClose = (id: string) => {
    if (sessions.length <= 1) return
    const closingCurrent = id === currentSessionId
    const filtered = sessions.filter((session) => session.id !== id)
    setSessions(
      filtered.map((session) =>
        session.id === currentSessionId ? { ...session, messages } : session
      )
    )
    if (closingCurrent) {
      setCurrentSessionId(filtered[Math.max(filtered.length - 1, 0)].id)
    }
    setInput("")
  }

  const handleSessionRename = useCallback(
    (id: string) => {
      const target = sessions.find((session) => session.id === id)
      if (!target) return
      setSessionEditDialog({
        open: true,
        mode: "rename",
        sessionId: id,
        value: target.name,
      })
    },
    [sessions]
  )

  const handleSessionTag = useCallback(
    (id: string) => {
      const target = sessions.find((session) => session.id === id)
      if (!target) return
      setSessionEditDialog({
        open: true,
        mode: "tag",
        sessionId: id,
        value: target.tag || "",
      })
    },
    [sessions]
  )

  const handleSessionFork = useCallback(
    async (id: string) => {
      const source = sessions.find((session) => session.id === id)
      if (!source) return
      const forkName = `${source.name} (fork)`
      const forkSession: AgentSession = {
        ...createSession(forkName),
        messages: source.messages,
        tag: source.tag || null,
      }

      setSessions((prev) => prev.concat(forkSession))
      setCurrentSessionId(forkSession.id)

      try {
        await fetch("/api/agent/sessions/fork", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceConversationId: source.conversationId,
            targetConversationId: forkSession.conversationId,
          }),
        })
      } catch {
        // ignore
      }
    },
    [sessions]
  )

  const handleSessionEditSave = useCallback(async () => {
    const targetId = sessionEditDialog.sessionId
    if (!targetId) return
    const target = sessions.find((session) => session.id === targetId)
    if (!target) return

    if (sessionEditDialog.mode === "rename") {
      const trimmed = sessionEditDialog.value.trim()
      if (!trimmed) return
      setSessions((prev) =>
        prev.map((session) =>
          session.id === targetId ? { ...session, name: trimmed } : session
        )
      )
      try {
        await fetch("/api/agent/sessions/rename", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: target.conversationId,
            title: trimmed,
          }),
        })
      } catch {
        // ignore
      }
    } else {
      const normalized = sessionEditDialog.value.trim() || null
      setSessions((prev) =>
        prev.map((session) =>
          session.id === targetId ? { ...session, tag: normalized } : session
        )
      )
      try {
        await fetch("/api/agent/sessions/tag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: target.conversationId,
            tag: normalized,
          }),
        })
      } catch {
        // ignore
      }
    }

    setSessionEditDialog((prev) => ({ ...prev, open: false }))
  }, [sessionEditDialog, sessions])

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    if (projectPath) inputRef.current?.focus()
  }, [projectPath])

  useEffect(() => {
    if (!projectPath) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGitBranch(null)
      return
    }

    let disposed = false

    const loadBranch = async () => {
      try {
        const res = await fetch("/api/agent/git-branch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cwd: projectPath }),
        })
        const data = (await res.json()) as {
          branch: string | null
          isGit: boolean
        }
        if (!disposed) {
          setGitBranch(data.isGit ? data.branch : null)
        }
      } catch {
        if (!disposed) setGitBranch(null)
      }
    }

    loadBranch()
    const interval = window.setInterval(loadBranch, 5000)
    return () => {
      disposed = true
      window.clearInterval(interval)
    }
  }, [projectPath])

  useEffect(() => {
    if (hydratedFromStorageRef.current) return
    hydratedFromStorageRef.current = true

    const persisted = readPersistedAgentState()
    if (!persisted) return

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProjectPath(persisted.projectPath)
    setProjectInfo(persisted.projectInfo)
    setModelId(persisted.modelId || "anthropic:sonnet")

    if (persisted.sessions.length > 0) {
      setSessions(persisted.sessions)
      const exists = persisted.sessions.some(
        (session) => session.id === persisted.currentSessionId
      )
      setCurrentSessionId(
        exists ? persisted.currentSessionId : persisted.sessions[0].id
      )
    }
  }, [])

  useEffect(() => {
    let disposed = false
    const loadSessionMetadata = async () => {
      try {
        const res = await fetch("/api/agent/sessions")
        const data = (await res.json()) as {
          sessions?: Array<{
            conversationId: string
            title?: string
            tag?: string | null
          }>
        }
        if (disposed || !Array.isArray(data.sessions)) return
        const byConversation = new Map(
          data.sessions.map((session) => [session.conversationId, session])
        )
        setSessions((prev) =>
          prev.map((session) => {
            const meta = byConversation.get(session.conversationId)
            if (!meta) return session
            return {
              ...session,
              name: meta.title || session.name,
              tag: meta.tag ?? session.tag ?? null,
            }
          })
        )
      } catch {
        // ignore metadata load failures
      }
    }
    void loadSessionMetadata()
    return () => {
      disposed = true
    }
  }, [])

  useEffect(() => {
    if (!hydratedFromStorageRef.current) return
    if (!activeSession) return

    writePersistedAgentState({
      projectPath,
      projectInfo,
      modelId,
      sessions,
      currentSessionId,
    })
  }, [
    projectPath,
    projectInfo,
    modelId,
    sessions,
    currentSessionId,
    activeSession,
  ])

  useEffect(() => {
    if (!activeSession?.conversationId) return
    let disposed = false

    const loadProtocol = async () => {
      try {
        const res = await fetch(
          `/api/agent/protocol?conversationId=${encodeURIComponent(
            activeSession.conversationId
          )}`
        )
        const data = (await res.json()) as {
          events?: Array<{
            type: string
            subtype?: string
            payload?: Record<string, unknown>
          }>
        }
        if (disposed) return
        const events = data.events || []
        const lastStatus = [...events]
          .reverse()
          .find(
            (event) => event.type === "system" && event.subtype === "status"
          )
        const lastResult = [...events]
          .reverse()
          .find((event) => event.type === "result")
        const usage = lastResult?.payload?.usage as
          | { estimatedCostUsd?: number }
          | undefined
        setRuntimeStatus(
          lastStatus?.payload?.status ? String(lastStatus.payload.status) : null
        )
        setEstimatedCostUsd(
          typeof usage?.estimatedCostUsd === "number"
            ? usage.estimatedCostUsd
            : null
        )
      } catch {
        if (!disposed) {
          setRuntimeStatus(null)
          setEstimatedCostUsd(null)
        }
      }
    }

    void loadProtocol()
    const interval = window.setInterval(loadProtocol, 4000)
    return () => {
      disposed = true
      window.clearInterval(interval)
    }
  }, [activeSession?.conversationId, messages.length, status])

  useEffect(() => {
    const updateSettings = () => {
      const settings = readAgentSettings()
      setProviderApiKeys(settings.providerApiKeys)
      setPermissionMode(settings.permissionMode)
    }
    updateSettings()
    window.addEventListener("staged-agent-settings-updated", updateSettings)
    window.addEventListener("storage", updateSettings)
    return () => {
      window.removeEventListener(
        "staged-agent-settings-updated",
        updateSettings
      )
      window.removeEventListener("storage", updateSettings)
    }
  }, [])

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile()
        if (file) {
          const reader = new FileReader()
          reader.onload = (event) => {
            if (event.target?.result) {
              setPastedImage(event.target.result as string)
            }
          }
          reader.readAsDataURL(file)
          e.preventDefault()
          return
        }
      }
    }
  }

  const handleSend = useCallback(() => {
    if ((!input.trim() && !pastedImage) || isLoading) return

    const parts: Array<{
      type: "text" | "image"
      text?: string
      image?: string
    }> = []
    if (pastedImage) {
      parts.push({ type: "image", image: pastedImage })
    }
    if (input.trim()) {
      parts.push({ type: "text", text: input })
    }

    setInput("")
    setPastedImage(null)

    sendMessage(
      { parts },
      {
        body: {
          projectPath: projectPath || "",
          modelId,
          conversationId: activeSession?.conversationId,
          backend: "auto",
          providerApiKeys,
          permissionMode,
        },
      }
    )
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
    }
  }, [
    input,
    pastedImage,
    isLoading,
    sendMessage,
    projectPath,
    modelId,
    activeSession?.conversationId,
    providerApiKeys,
    permissionMode,
  ])

  const handleAbort = useCallback(() => {
    stop()
    if (!activeConversationId) return
    fetch("/api/agent/abort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: activeConversationId }),
    }).catch(() => {})
  }, [activeConversationId, stop])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleDisconnect = () => {
    const firstSession = createSession("Chat 1")
    setProjectPath(null)
    setProjectInfo(null)
    setSessions([firstSession])
    setCurrentSessionId(firstSession.id)
    setMessages(firstSession.messages)
    setInput("")
  }

  // ── Connect screen ──
  if (!projectPath) {
    return (
      <ConnectScreen
        onConnect={(path, info) => {
          setProjectPath(path)
          setProjectInfo(info)
        }}
        modelId={modelId}
        onModelChange={setModelId}
      />
    )
  }

  // ── Main chat view ──
  return (
    <div className="flex h-full w-full flex-col bg-background">
      {/* Header bar */}
      <div className="flex h-11 items-center gap-2 border-b bg-muted/30 px-4">
        <span className="text-sm font-medium text-foreground">Staged AI</span>
        <span className="text-border">|</span>
        <FolderOpen className="h-3 w-3 text-muted-foreground" />
        <code className="max-w-[200px] truncate text-xs text-muted-foreground">
          {projectInfo?.name ?? projectPath}
        </code>
        {projectInfo?.isGit && (
          <div className="flex items-center gap-1">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
              <GitBranch className="h-3 w-3" />
              <span className="text-[9px] tracking-wide uppercase opacity-80">
                Branch
              </span>
            </span>
            {gitBranch && (
              <code className="max-w-[140px] truncate rounded-full border border-border bg-muted px-2 py-0.5 text-[10px]">
                {gitBranch}
              </code>
            )}
          </div>
        )}

        <span className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {modelId}
        </span>
        {runtimeStatus && (
          <span className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {runtimeStatus}
          </span>
        )}
        {estimatedCostUsd != null && (
          <span className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            ${estimatedCostUsd.toFixed(4)}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={handleDisconnect}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Disconnect"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <SessionTabs
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSessionSelect={handleSessionSelect}
        onNewSession={handleNewSession}
        onSessionClose={handleSessionClose}
        onSessionRename={handleSessionRename}
        onSessionTag={handleSessionTag}
        onSessionFork={handleSessionFork}
      />

      <Dialog
        open={sessionEditDialog.open}
        onOpenChange={(open) =>
          setSessionEditDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {sessionEditDialog.mode === "rename"
                ? "Rename Session"
                : "Tag Session"}
            </DialogTitle>
          </DialogHeader>
          <Input
            value={sessionEditDialog.value}
            onChange={(e) =>
              setSessionEditDialog((prev) => ({
                ...prev,
                value: e.target.value,
              }))
            }
            placeholder={
              sessionEditDialog.mode === "rename"
                ? "Session name"
                : "Tag (empty to clear)"
            }
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setSessionEditDialog((prev) => ({ ...prev, open: false }))
              }
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSessionEditSave()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="space-y-3 p-4 text-sm">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border bg-muted">
                <Sparkles className="h-6 w-6 text-foreground/60" />
              </div>
              <p className="text-lg font-semibold text-foreground">
                What should we build?
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {projectInfo?.name} — {projectInfo?.fileCount} files
                {projectInfo?.isGit ? " — git repo" : ""}
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                {[
                  "What does this project do?",
                  "Run the tests",
                  "Find all TODO comments",
                  "Refactor this codebase",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setInput(s)
                      inputRef.current?.focus()
                    }}
                    className="rounded-full border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => {
            const parts = (message.parts || []) as AgentMessagePart[]

            if (message.role === "user") {
              return (
                <div
                  key={message.id}
                  className="flex items-start gap-2 rounded-lg border bg-muted p-3"
                >
                  <span className="flex-shrink-0 font-bold text-primary">
                    &gt;
                  </span>
                  <div className="flex flex-col gap-2">
                    {parts.map((part, i) => {
                      if (part.type === "text" && part.text) {
                        return (
                          <span
                            key={i}
                            className="whitespace-pre-wrap text-foreground"
                          >
                            {part.text}
                          </span>
                        )
                      }
                      if (
                        part.type === "image" &&
                        typeof part.image === "string"
                      ) {
                        return (
                          <img
                            key={i}
                            src={part.image}
                            alt="User provided image"
                            className="max-h-64 rounded-lg"
                          />
                        )
                      }
                      return null
                    })}
                  </div>
                </div>
              )
            }

            // Assistant messages
            return (
              <div key={message.id} className="space-y-1 font-mono">
                {parts.map((part, i: number) => {
                  // Tool invocations — v6: type is "tool-{name}"
                  if (
                    part.type?.startsWith("tool-") &&
                    part.type !== "tool-invocation" &&
                    part.toolCallId
                  ) {
                    const toolName = part.type.replace("tool-", "")
                    return (
                      <ToolCallBlock
                        key={`${message.id}-${i}`}
                        toolName={toolName}
                        input={part.input}
                        output={part.output}
                        state={part.state || "result"}
                      />
                    )
                  }
                  // Fallback: "tool-invocation" type
                  if (part.type === "tool-invocation") {
                    const inv = part.toolInvocation ?? {}
                    return (
                      <ToolCallBlock
                        key={`${message.id}-${i}`}
                        toolName={inv.toolName || "unknown"}
                        input={inv.args || inv.input}
                        output={inv.result ?? inv.output}
                        state={inv.state || "result"}
                      />
                    )
                  }
                  // Text
                  if (part.type === "text" && part.text?.trim()) {
                    return (
                      <div
                        key={`${message.id}-${i}`}
                        className="pl-0 font-sans text-sm leading-relaxed whitespace-pre-wrap text-foreground/90"
                        dangerouslySetInnerHTML={{
                          __html: formatMarkdown(part.text),
                        }}
                      />
                    )
                  }
                  // Step divider
                  if (part.type === "step-start") {
                    return (
                      <div
                        key={`${message.id}-${i}`}
                        className="my-2 h-px bg-border"
                      />
                    )
                  }
                  if (
                    part.type === "data-agent_event" ||
                    part.type === "data-claude_event"
                  ) {
                    return (
                      <AgentEventBlock
                        key={`${message.id}-${i}`}
                        event={
                          typeof part.data === "object" && part.data
                            ? (part.data as Record<string, unknown>)
                            : { raw: part.data }
                        }
                      />
                    )
                  }
                  if (
                    part.type === "data-agent_status" ||
                    part.type === "data-claude_status"
                  ) {
                    const status = isRecord(part.data)
                      ? part.data.status
                      : undefined
                    if (typeof status !== "string") return null
                    return (
                      <AgentStatusBlock
                        key={`${message.id}-${i}`}
                        status={status}
                      />
                    )
                  }
                  if (
                    part.type === "data-agent_thinking" ||
                    part.type === "data-claude_thinking"
                  ) {
                    const delta = isRecord(part.data)
                      ? part.data.delta
                      : undefined
                    if (typeof delta !== "string" || !delta.trim()) return null
                    return (
                      <AgentThinkingBlock
                        key={`${message.id}-${i}`}
                        text={delta}
                      />
                    )
                  }
                  if (part.type === "error") {
                    return (
                      <div
                        key={`${message.id}-${i}`}
                        className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-sans text-sm text-destructive"
                      >
                        {typeof part.errorText === "string"
                          ? part.errorText
                          : "Agent error occurred."}
                      </div>
                    )
                  }
                  return null
                })}
              </div>
            )
          })}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Thinking...</span>
            </div>
          )}
        </div>
      </div>

      {/* Input bar — Codex style */}
      <div className="px-4 pb-4">
        <div className="rounded-2xl border bg-muted/30">
          <div className="px-4 pt-3 pb-1">
            {pastedImage && (
              <div className="relative mb-2 h-24 w-24 rounded-md border">
                <img
                  src={pastedImage}
                  alt="Pasted content"
                  className="h-full w-full rounded-md object-cover"
                />
                <button
                  onClick={() => setPastedImage(null)}
                  className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/50 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-background/80 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Ask Staged AI anything..."
              rows={1}
              className="max-h-32 w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
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
              onChange={(event) => {
                const nextMode = event.target.value as "edit" | "plan"
                setPermissionMode(nextMode)
                const current = readAgentSettings()
                writeAgentSettings({
                  providerApiKeys: current.providerApiKeys,
                  permissionMode: nextMode,
                })
              }}
              className="h-7 rounded-md border bg-background px-2 text-xs text-muted-foreground"
              title="Permission mode"
            >
              <option value="plan">Plan</option>
              <option value="edit">Edit</option>
            </select>
            <div className="ml-auto">
              <button
                type="button"
                disabled={!isLoading && !input.trim()}
                onClick={isLoading ? handleAbort : handleSend}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
                title={isLoading ? "Stop current run" : "Send"}
              >
                {isLoading ? (
                  <X className="h-4 w-4" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Markdown formatter ───────────────────────────────────

function formatMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /```(\w*)\n([\s\S]*?)```/g,
      '<pre class="rounded border bg-muted p-3 text-xs overflow-x-auto my-2 font-mono"><code>$2</code></pre>'
    )
    .replace(
      /`([^`]+)`/g,
      '<code class="rounded bg-muted border px-1.5 py-0.5 text-xs font-mono">$1</code>'
    )
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>")
}
