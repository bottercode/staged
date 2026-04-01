"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import {
  Send,
  Bot,
  Loader2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileCode,
  Terminal,
  Search,
  FolderOpen,
  PenLine,
  X,
  GitBranch,
  ArrowRight,
  Clock,
  Sparkles,
  Zap,
  FileText,
  Code2,
  Plus,
  SquareTerminal,
  Minus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

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

// ── Tool display helpers ─────────────────────────────────

const TOOL_ICONS: Record<string, React.ReactNode> = {
  Read: <FileCode className="h-3.5 w-3.5" />,
  Write: <PenLine className="h-3.5 w-3.5" />,
  Edit: <PenLine className="h-3.5 w-3.5" />,
  Bash: <Terminal className="h-3.5 w-3.5" />,
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

function getToolSummary(toolName: string, input: any): string {
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
  input: any
  output: any
  state: string
}) {
  const [expanded, setExpanded] = useState(false)
  const isRunning =
    state === "call" ||
    state === "partial-call" ||
    state === "input-streaming" ||
    state === "input-available"
  const hasError = output && typeof output === "object" && "error" in output

  const summary = getToolSummary(toolName, input)

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
          {TOOL_ICONS[toolName] ?? <Terminal className="h-3.5 w-3.5" />}
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
          {input && (
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

// ── Model list ───────────────────────────────────────────

const MODELS = [
  {
    id: "claude-sonnet-4-20250514",
    label: "Claude Sonnet 4",
    provider: "Anthropic",
  },
  {
    id: "claude-opus-4-20250514",
    label: "Claude Opus 4",
    provider: "Anthropic",
  },
  {
    id: "claude-haiku-4-20250414",
    label: "Claude Haiku 4",
    provider: "Anthropic",
  },
  { id: "gpt-4o", label: "GPT-4o", provider: "OpenAI" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI" },
  { id: "o3", label: "o3", provider: "OpenAI" },
  { id: "o4-mini", label: "o4-mini", provider: "OpenAI" },
  {
    id: "gemini-2.5-pro-preview-05-06",
    label: "Gemini 2.5 Pro",
    provider: "Google",
  },
  {
    id: "gemini-2.5-flash-preview-04-17",
    label: "Gemini 2.5 Flash",
    provider: "Google",
  },
  { id: "grok-3", label: "Grok 3", provider: "xAI" },
  { id: "grok-3-mini", label: "Grok 3 Mini", provider: "xAI" },
  { id: "mistral-large-latest", label: "Mistral Large", provider: "Mistral" },
  { id: "codestral-latest", label: "Codestral", provider: "Mistral" },
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
  const current = MODELS.find((m) => m.id === value) ?? MODELS[0]

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
        {current.label}
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
                    onChange(m.id)
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
    if (open && !browseData) browse()
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
                  onDoubleClick={() => browse(`${browseData.path}/${folder}`)}
                  onClick={() => setPathInput(`${browseData.path}/${folder}`)}
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
}: {
  onConnect: (path: string, info: ProjectInfo) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentFolders, setRecentFolders] = useState<string[]>([])
  const [showBrowser, setShowBrowser] = useState(false)

  useEffect(() => {
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
          {recentFolders.length > 0 && (
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
            <ModelSelector
              value="claude-sonnet-4-20250514"
              onChange={() => {}}
            />
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

// ── Terminal panel ────────────────────────────────────────

type TerminalLine = {
  type: "input" | "stdout" | "stderr"
  text: string
}

function TerminalPanel({ cwd, onClose }: { cwd: string; onClose: () => void }) {
  const [lines, setLines] = useState<TerminalLine[]>([])
  const [cmd, setCmd] = useState("")
  const [running, setRunning] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight)
  }, [lines])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const run = async (command: string) => {
    if (!command.trim()) return
    setRunning(true)
    setHistory((h) => [command, ...h.slice(0, 50)])
    setHistIdx(-1)
    setLines((prev) => [...prev, { type: "input", text: command }])
    setCmd("")

    try {
      // Handle cd locally
      if (command.trim().startsWith("clear")) {
        setLines([])
        setRunning(false)
        return
      }

      const res = await fetch("/api/agent/terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, cwd }),
      })
      const data = await res.json()

      const newLines: TerminalLine[] = []
      if (data.stdout) newLines.push({ type: "stdout", text: data.stdout })
      if (data.stderr) newLines.push({ type: "stderr", text: data.stderr })
      if (newLines.length === 0 && data.exitCode !== 0) {
        newLines.push({ type: "stderr", text: `Exit code: ${data.exitCode}` })
      }
      setLines((prev) => [...prev, ...newLines])
    } catch {
      setLines((prev) => [
        ...prev,
        { type: "stderr", text: "Failed to execute command" },
      ])
    }
    setRunning(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      run(cmd)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (history.length > 0) {
        const next = Math.min(histIdx + 1, history.length - 1)
        setHistIdx(next)
        setCmd(history[next])
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      if (histIdx > 0) {
        const next = histIdx - 1
        setHistIdx(next)
        setCmd(history[next])
      } else {
        setHistIdx(-1)
        setCmd("")
      }
    }
  }

  const dirName = cwd.split("/").pop() || cwd

  return (
    <div className="flex flex-col border-t bg-background">
      {/* Terminal header */}
      <div className="flex h-9 items-center gap-2 border-b bg-muted/30 px-3">
        <SquareTerminal className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          Terminal
        </span>
        <code className="text-[10px] text-muted-foreground/60">{dirName}</code>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal output */}
      <div
        ref={scrollRef}
        onClick={() => inputRef.current?.focus()}
        className="h-48 overflow-y-auto bg-background p-3 font-mono text-xs"
      >
        {lines.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap">
            {line.type === "input" ? (
              <span>
                <span className="text-primary">$</span>{" "}
                <span className="text-foreground">{line.text}</span>
              </span>
            ) : line.type === "stderr" ? (
              <span className="text-destructive">{line.text}</span>
            ) : (
              <span className="text-foreground/80">{line.text}</span>
            )}
          </div>
        ))}

        {/* Input line */}
        <div className="flex items-center gap-1">
          <span className="text-primary">$</span>
          <input
            ref={inputRef}
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={running}
            className="flex-1 bg-transparent text-foreground caret-primary focus:outline-none disabled:opacity-50"
            spellCheck={false}
            autoComplete="off"
          />
          {running && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Agent Panel ─────────────────────────────────────

export function AgentPanel() {
  const [projectPath, setProjectPath] = useState<string | null>(null)
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null)
  const [input, setInput] = useState("")
  const [modelId, setModelId] = useState("claude-sonnet-4-20250514")
  const [showTerminal, setShowTerminal] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/agent",
        body: { projectPath: projectPath || "", modelId },
      }),
    [projectPath, modelId]
  )

  const { messages, sendMessage, status, setMessages } = useChat({ transport })
  const isLoading = status === "streaming" || status === "submitted"

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

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return
    const text = input
    setInput("")
    sendMessage({ text })
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
    }
  }, [input, isLoading, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleDisconnect = () => {
    setProjectPath(null)
    setProjectInfo(null)
    setMessages([])
  }

  // ── Connect screen ──
  if (!projectPath) {
    return (
      <ConnectScreen
        onConnect={(path, info) => {
          setProjectPath(path)
          setProjectInfo(info)
        }}
      />
    )
  }

  // ── Main chat view ──
  return (
    <div className="flex h-full w-full flex-col bg-background">
      {/* Header bar */}
      <div className="flex h-11 items-center gap-2 border-b bg-muted/30 px-4">
        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Staged AI</span>
        <span className="text-border">|</span>
        <FolderOpen className="h-3 w-3 text-muted-foreground" />
        <code className="max-w-[200px] truncate text-xs text-muted-foreground">
          {projectInfo?.name ?? projectPath}
        </code>
        {projectInfo?.isGit && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <GitBranch className="h-3 w-3" />
          </div>
        )}
        {projectInfo?.projectType && projectInfo.projectType !== "unknown" && (
          <span className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {PROJECT_TYPE_LABELS[projectInfo.projectType]}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setShowTerminal(!showTerminal)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              showTerminal
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            title="Toggle terminal"
          >
            <SquareTerminal className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleDisconnect}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Disconnect"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="space-y-3 p-4 font-mono text-sm">
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
            const parts = (message as any).parts || []

            if (message.role === "user") {
              const textContent = parts
                .filter((p: any) => p.type === "text")
                .map((p: any) => p.text)
                .join("")
              return (
                <div key={message.id} className="flex gap-2">
                  <span className="flex-shrink-0 font-bold text-primary">
                    &gt;
                  </span>
                  <span className="text-foreground">{textContent}</span>
                </div>
              )
            }

            // Assistant messages
            return (
              <div key={message.id} className="space-y-1">
                {parts.map((part: any, i: number) => {
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
                        state={part.state}
                      />
                    )
                  }
                  // Fallback: "tool-invocation" type
                  if (part.type === "tool-invocation") {
                    const inv = part.toolInvocation || part
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

      {/* Terminal */}
      {showTerminal && projectPath && (
        <TerminalPanel
          cwd={projectPath}
          onClose={() => setShowTerminal(false)}
        />
      )}

      {/* Input bar — Codex style */}
      <div className="px-4 pb-4">
        <div className="rounded-2xl border bg-muted/30">
          <div className="px-4 pt-3 pb-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
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
            <div className="ml-auto">
              <button
                type="button"
                disabled={!input.trim() || isLoading}
                onClick={handleSend}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
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
