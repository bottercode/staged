import { spawn, type ChildProcessWithoutNullStreams } from "child_process"
import { randomUUID } from "crypto"
import fs from "fs/promises"
import path from "path"
import { resolveFallbackModelId } from "@/server/agent/models"

const conversationSessionMap = new Map<string, string>()
const SESSION_STORE_PATH = path.join(
  process.cwd(),
  ".staged-agent",
  "agent-session-map.json"
)
let sessionStoreLoaded = false
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: string) {
  return UUID_REGEX.test(value)
}

async function loadSessionStore() {
  if (sessionStoreLoaded) return
  sessionStoreLoaded = true

  try {
    const raw = await fs.readFile(SESSION_STORE_PATH, "utf-8")
    const parsed = JSON.parse(raw) as Record<string, string>
    for (const [conversationId, sessionId] of Object.entries(parsed)) {
      if (conversationId && isUuid(sessionId)) {
        conversationSessionMap.set(conversationId, sessionId)
      }
    }
  } catch {
    // ignore; persistence is best-effort
  }
}

async function persistSessionStore() {
  try {
    await fs.mkdir(path.dirname(SESSION_STORE_PATH), { recursive: true })
    await fs.writeFile(
      SESSION_STORE_PATH,
      JSON.stringify(Object.fromEntries(conversationSessionMap), null, 2),
      "utf-8"
    )
  } catch {
    // non-fatal
  }
}

async function resolveSessionId(conversationId?: string) {
  await loadSessionStore()

  if (!conversationId) return randomUUID()
  if (conversationSessionMap.has(conversationId)) {
    return conversationSessionMap.get(conversationId)!
  }

  const sessionId = isUuid(conversationId) ? conversationId : randomUUID()
  conversationSessionMap.set(conversationId, sessionId)
  await persistSessionStore()
  return sessionId
}

function getLastUserMessage(messages: unknown[]) {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index] as {
      role?: string
      parts?: Array<{ type?: string; text?: string }>
      content?: string
    }
    if (message?.role !== "user") continue

    const fromParts = (message.parts || [])
      .filter((part) => part?.type === "text" && part.text)
      .map((part) => part.text)
      .join("\n")
      .trim()

    if (fromParts) return fromParts
    if (typeof message.content === "string" && message.content.trim()) {
      return message.content.trim()
    }
  }
  return ""
}

type RunnerEvent = {
  type?: string
  subtype?: string
  message?: {
    role?: string
    content?: Array<Record<string, unknown>>
  }
  result?: string
  is_error?: boolean
  session_id?: string
}

type AgentRunInput = {
  messages: unknown[]
  projectPath: string
  modelId?: string
  conversationId?: string
  permissionMode?: "manualEdits" | "bypassPermissions" | "plan"
}

type AgentRunCallbacks = {
  onTextDelta?: (delta: string) => void
  onThinkingDelta?: (delta: string) => void
  onToolInput?: (toolCallId: string, toolName: string, input: unknown) => void
  onToolOutput?: (toolCallId: string, output: unknown) => void
  onStatus?: (status: string) => void
  onRawEvent?: (event: RunnerEvent) => void
}

export type AgentRunResult = {
  sessionId: string
  isError: boolean
  finalText: string
  stderr: string
  emittedTextLength: number
  retryCount: number
}

const activeConversationRuns = new Map<
  string,
  {
    child: ChildProcessWithoutNullStreams
    pendingToolCalls: Set<string>
    toolNames: Map<string, string>
  }
>()

export function stopAgentRun(conversationId: string): boolean {
  const run = activeConversationRuns.get(conversationId)
  if (!run) return false
  try {
    run.child.kill("SIGTERM")
    return true
  } catch {
    return false
  }
}

function extractAssistantText(content: Array<Record<string, unknown>>) {
  return content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("")
}

function extractThinkingText(content: Array<Record<string, unknown>>) {
  return content
    .filter((block) => block.type === "thinking")
    .map((block) => {
      if (typeof block.thinking === "string") return block.thinking
      if (typeof block.text === "string") return block.text
      return ""
    })
    .join("")
}

function processToolBlocks(
  content: Array<Record<string, unknown>>,
  callbacks: AgentRunCallbacks,
  emittedToolInputs: Set<string>,
  emittedToolOutputs: Set<string>,
  toolNames: Map<string, string>,
  pendingToolCalls: Set<string>
) {
  for (const block of content) {
    if (block.type !== "tool_use") continue
    const id = typeof block.id === "string" ? block.id : randomUUID()
    const name = typeof block.name === "string" ? block.name : "tool"
    toolNames.set(id, name)
    pendingToolCalls.add(id)
    if (!emittedToolInputs.has(id)) {
      emittedToolInputs.add(id)
      callbacks.onToolInput?.(id, name, block.input)
    }
  }

  for (const block of content) {
    if (block.type !== "tool_result") continue
    const toolUseId =
      typeof block.tool_use_id === "string" ? block.tool_use_id : randomUUID()
    pendingToolCalls.delete(toolUseId)
    if (!emittedToolInputs.has(toolUseId)) {
      emittedToolInputs.add(toolUseId)
      callbacks.onToolInput?.(toolUseId, toolNames.get(toolUseId) || "tool", {
        note: "Tool output arrived before matching tool_use block",
      })
    }
    if (!emittedToolOutputs.has(toolUseId)) {
      emittedToolOutputs.add(toolUseId)
      callbacks.onToolOutput?.(toolUseId, block.content)
    }
  }
}

function isRetryableAgentError(stderr: string) {
  const s = stderr.toLowerCase()
  return (
    s.includes("rate limit") ||
    s.includes("overload") ||
    s.includes("timeout") ||
    s.includes("temporar") ||
    s.includes("econnreset") ||
    s.includes("socket hang up")
  )
}

function isPromptTooLongError(stderr: string) {
  const s = stderr.toLowerCase()
  return (
    s.includes("prompt too long") ||
    s.includes("maximum context length") ||
    s.includes("context window") ||
    s.includes("input is too long")
  )
}

function isStructuredOutputError(stderr: string) {
  const s = stderr.toLowerCase()
  return s.includes("json") || s.includes("structured output")
}

function compactPromptForRetry(prompt: string, level: "snip" | "reactive") {
  const max =
    level === "snip"
      ? 10_000
      : 6_500
  if (prompt.length <= max) return prompt
  const head = Math.floor(max * 0.35)
  const tail = max - head
  return `${prompt.slice(0, head)}\n\n[...context snipped for ${level} retry...]\n\n${prompt.slice(-tail)}`
}

async function runAgentStreamOnce(
  {
    messages,
    projectPath,
    modelId,
    conversationId,
    permissionMode,
  }: AgentRunInput,
  callbacks: AgentRunCallbacks = {}
): Promise<AgentRunResult> {
  const basePrompt = getLastUserMessage(messages)
  const prompt = basePrompt
  const sessionId = await resolveSessionId(conversationId)

  if (!prompt) {
    return {
      sessionId,
      isError: true,
      finalText: "I could not find a user prompt in this request.",
      stderr: "",
      emittedTextLength: 0,
      retryCount: 0,
    }
  }

  const cliPermissionMode =
    permissionMode === "manualEdits"
      ? "acceptEdits"
      : permissionMode === "plan"
        ? "plan"
        : "bypassPermissions"

  const args = [
    "-p",
    "--verbose",
    "--output-format",
    "stream-json",
    "--include-partial-messages",
    "--session-id",
    sessionId,
    "--permission-mode",
    cliPermissionMode,
  ]
  if (modelId) args.push("--model", modelId)
  args.push(prompt)

  const child = spawn("claude", args, {
    cwd: projectPath,
    shell: false,
    env: { ...process.env, TERM: "xterm-256color" },
  })

  let stdoutBuffer = ""
  let stderr = ""
  let lastAssistantText = ""
  let lastThinkingText = ""
  let finalText = ""
  let isError = false
  let emittedTextLength = 0
  const emittedToolInputs = new Set<string>()
  const emittedToolOutputs = new Set<string>()
  const toolNames = new Map<string, string>()
  const pendingToolCalls = new Set<string>()

  const handleEvent = (event: RunnerEvent) => {
    callbacks.onRawEvent?.(event)
    if (event.type) {
      callbacks.onStatus?.(
        event.subtype ? `${event.type}.${event.subtype}` : event.type
      )
    }

    if (event.session_id && isUuid(event.session_id) && conversationId) {
      conversationSessionMap.set(conversationId, event.session_id)
      void persistSessionStore()
    }

    if (Array.isArray(event.message?.content)) {
      const content = event.message.content as Array<Record<string, unknown>>
      processToolBlocks(
        content,
        callbacks,
        emittedToolInputs,
        emittedToolOutputs,
        toolNames,
        pendingToolCalls
      )

      const thinkingText = extractThinkingText(content)
      if (thinkingText) {
        if (thinkingText.startsWith(lastThinkingText)) {
          const delta = thinkingText.slice(lastThinkingText.length)
          if (delta) callbacks.onThinkingDelta?.(delta)
        } else if (thinkingText !== lastThinkingText) {
          callbacks.onThinkingDelta?.(`\n${thinkingText}`)
        }
        lastThinkingText = thinkingText
      }
    }

    if (event.type === "assistant" && Array.isArray(event.message?.content)) {
      const content = event.message.content as Array<Record<string, unknown>>
      const fullText = extractAssistantText(content)
      if (fullText) {
        if (fullText.startsWith(lastAssistantText)) {
          const delta = fullText.slice(lastAssistantText.length)
          if (delta) {
            emittedTextLength += delta.length
            callbacks.onTextDelta?.(delta)
          }
        } else if (fullText !== lastAssistantText) {
          const delta = `\n${fullText}`
          emittedTextLength += delta.length
          callbacks.onTextDelta?.(delta)
        }
        lastAssistantText = fullText
        finalText = fullText
      }
    }

    if (event.type === "result") {
      isError = Boolean(event.is_error)
      if (typeof event.result === "string" && event.result.trim()) {
        finalText = event.result
      }
    }
  }

  const flushLines = (chunk: string) => {
    stdoutBuffer += chunk
    const lines = stdoutBuffer.split("\n")
    stdoutBuffer = lines.pop() ?? ""
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        handleEvent(JSON.parse(trimmed) as RunnerEvent)
      } catch {
        // ignore malformed lines from subprocess output
      }
    }
  }

  return new Promise<AgentRunResult>((resolve, reject) => {
    if (conversationId) {
      activeConversationRuns.set(conversationId, {
        child,
        pendingToolCalls,
        toolNames,
      })
    }

    child.stdout.on("data", (chunk: Buffer) => flushLines(chunk.toString()))
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on("error", reject)

    child.on("close", (code: number | null) => {
      if (stdoutBuffer.trim()) {
        try {
          handleEvent(JSON.parse(stdoutBuffer.trim()) as RunnerEvent)
        } catch {
          // ignore malformed trailing line
        }
      }

      const resolvedSession = conversationId
        ? conversationSessionMap.get(conversationId) || sessionId
        : sessionId

      if (conversationId) {
        activeConversationRuns.delete(conversationId)
      }

      for (const toolCallId of pendingToolCalls) {
        if (!emittedToolOutputs.has(toolCallId)) {
          emittedToolOutputs.add(toolCallId)
          callbacks.onToolOutput?.(toolCallId, {
            error:
              "Tool execution ended before returning a result (run interrupted or failed).",
          })
        }
      }
      if (pendingToolCalls.size > 0) {
        callbacks.onStatus?.("orphaned_tool_results_tombstoned")
      }

      resolve({
        sessionId: resolvedSession,
        isError: isError || (code ?? 0) !== 0,
        finalText:
          finalText ||
          stderr.trim() ||
          "Agent runner did not return output. Make sure the configured runtime is available.",
        stderr,
        emittedTextLength,
        retryCount: 0,
      })
    })
  })
}

export async function runAgentStream(
  input: AgentRunInput,
  callbacks: AgentRunCallbacks = {}
): Promise<AgentRunResult> {
  const maxAttempts = 4
  let attempt = 1
  let lastResult: AgentRunResult | null = null
  let promptMode: "original" | "snip" | "reactive" = "original"
  let currentModelId = input.modelId
  let structuredRetryUsed = false

  while (attempt <= maxAttempts) {
    if (attempt > 1) callbacks.onStatus?.(`api_retry.${attempt}`)

    const prompt =
      promptMode === "original"
        ? getLastUserMessage(input.messages)
        : compactPromptForRetry(getLastUserMessage(input.messages), promptMode)

    const patchedInput: AgentRunInput = {
      ...input,
      modelId: currentModelId,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }

    const result = await runAgentStreamOnce(patchedInput, callbacks)
    lastResult = result

    const transientRetry =
      result.isError &&
      result.emittedTextLength === 0 &&
      isRetryableAgentError(result.stderr) &&
      attempt < maxAttempts

    if (transientRetry) {
      await new Promise((resolve) => setTimeout(resolve, 600 * attempt))
      attempt += 1
      continue
    }

    const promptTooLong =
      result.isError &&
      result.emittedTextLength === 0 &&
      isPromptTooLongError(result.stderr) &&
      attempt < maxAttempts

    if (promptTooLong) {
      promptMode = promptMode === "original" ? "snip" : "reactive"
      callbacks.onStatus?.(
        promptMode === "snip"
          ? "prompt_too_long_snip_retry"
          : "prompt_too_long_reactive_retry"
      )
      attempt += 1
      continue
    }

    const structuredRetry =
      result.isError &&
      result.emittedTextLength === 0 &&
      isStructuredOutputError(result.stderr) &&
      !structuredRetryUsed &&
      attempt < maxAttempts
    if (structuredRetry) {
      structuredRetryUsed = true
      callbacks.onStatus?.("structured_output_retry")
      attempt += 1
      continue
    }

    const fallbackRetry =
      result.isError &&
      result.emittedTextLength === 0 &&
      attempt < maxAttempts
    if (fallbackRetry) {
      const fallback = resolveFallbackModelId(currentModelId)
      if (fallback && fallback !== currentModelId) {
        currentModelId = fallback
        callbacks.onStatus?.("fallback_model_retry")
        attempt += 1
        continue
      }
    }

    return { ...result, retryCount: attempt - 1 }
  }

  return {
    ...(lastResult || {
      sessionId: "",
      isError: true,
      finalText: "Agent runner failed without a recoverable result.",
      stderr: "",
      emittedTextLength: 0,
      retryCount: 0,
    }),
    retryCount: maxAttempts - 1,
  }
}
