import { spawn } from "child_process"
import { randomUUID } from "crypto"

const conversationSessionMap = new Map<string, string>()
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: string) {
  return UUID_REGEX.test(value)
}

function resolveSessionId(conversationId?: string) {
  if (!conversationId) return randomUUID()

  if (conversationSessionMap.has(conversationId)) {
    return conversationSessionMap.get(conversationId)!
  }

  const sessionId = isUuid(conversationId) ? conversationId : randomUUID()
  conversationSessionMap.set(conversationId, sessionId)
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

type ClaudeEvent = {
  type?: string
  message?: {
    content?: Array<Record<string, unknown>>
  }
  result?: string
  is_error?: boolean
  session_id?: string
}

type ClaudeRunInput = {
  messages: unknown[]
  projectPath: string
  modelId?: string
  conversationId?: string
}

type ClaudeRunCallbacks = {
  onTextDelta?: (delta: string) => void
  onToolInput?: (toolCallId: string, toolName: string, input: unknown) => void
  onToolOutput?: (toolCallId: string, output: unknown) => void
  onRawEvent?: (event: ClaudeEvent) => void
}

export type ClaudeRunResult = {
  sessionId: string
  isError: boolean
  finalText: string
  stderr: string
}

function extractAssistantText(content: Array<Record<string, unknown>>) {
  return content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("")
}

function processToolBlocks(
  content: Array<Record<string, unknown>>,
  callbacks: ClaudeRunCallbacks,
  emittedToolInputs: Set<string>,
  emittedToolOutputs: Set<string>
) {
  for (const block of content) {
    if (block.type === "tool_use") {
      const id = typeof block.id === "string" ? block.id : randomUUID()
      const name = typeof block.name === "string" ? block.name : "tool"
      if (!emittedToolInputs.has(id)) {
        emittedToolInputs.add(id)
        callbacks.onToolInput?.(id, name, block.input)
      }
      continue
    }

    if (block.type === "tool_result") {
      const toolUseId =
        typeof block.tool_use_id === "string" ? block.tool_use_id : randomUUID()
      if (!emittedToolOutputs.has(toolUseId)) {
        emittedToolOutputs.add(toolUseId)
        callbacks.onToolOutput?.(toolUseId, block.content)
      }
    }
  }
}

export async function runClaudeCodeStream(
  {
    messages,
    projectPath,
    modelId,
    conversationId,
  }: ClaudeRunInput,
  callbacks: ClaudeRunCallbacks = {}
): Promise<ClaudeRunResult> {
  const prompt = getLastUserMessage(messages)
  const sessionId = resolveSessionId(conversationId)

  if (!prompt) {
    return {
      sessionId,
      isError: true,
      finalText: "I could not find a user prompt in this request.",
      stderr: "",
    }
  }

  const args = [
    "-p",
    "--verbose",
    "--output-format",
    "stream-json",
    "--include-partial-messages",
    "--session-id",
    sessionId,
    "--permission-mode",
    "bypassPermissions",
  ]

  if (modelId) {
    args.push("--model", modelId)
  }

  args.push(prompt)

  const child = spawn("claude", args, {
    cwd: projectPath,
    shell: false,
    env: { ...process.env, TERM: "xterm-256color" },
  })

  let stdoutBuffer = ""
  let stderr = ""
  let lastAssistantText = ""
  let finalText = ""
  let isError = false
  const emittedToolInputs = new Set<string>()
  const emittedToolOutputs = new Set<string>()

  const handleEvent = (event: ClaudeEvent) => {
    callbacks.onRawEvent?.(event)

    if (event.session_id && isUuid(event.session_id) && conversationId) {
      conversationSessionMap.set(conversationId, event.session_id)
    }

    if (event.type === "assistant" && Array.isArray(event.message?.content)) {
      const content = event.message.content as Array<Record<string, unknown>>
      processToolBlocks(content, callbacks, emittedToolInputs, emittedToolOutputs)

      const fullText = extractAssistantText(content)
      if (fullText) {
        if (fullText.startsWith(lastAssistantText)) {
          const delta = fullText.slice(lastAssistantText.length)
          if (delta) callbacks.onTextDelta?.(delta)
        } else if (fullText !== lastAssistantText) {
          callbacks.onTextDelta?.(`\n${fullText}`)
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
        handleEvent(JSON.parse(trimmed) as ClaudeEvent)
      } catch {
        // ignore malformed lines from third-party output
      }
    }
  }

  return new Promise<ClaudeRunResult>((resolve, reject) => {
    child.stdout.on("data", (chunk: Buffer) => {
      flushLines(chunk.toString())
    })

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    child.on("error", reject)

    child.on("close", (code: number | null) => {
      if (stdoutBuffer.trim()) {
        try {
          handleEvent(JSON.parse(stdoutBuffer.trim()) as ClaudeEvent)
        } catch {
          // ignore trailing malformed line
        }
      }

      const resolvedSession = conversationId
        ? conversationSessionMap.get(conversationId) || sessionId
        : sessionId

      resolve({
        sessionId: resolvedSession,
        isError: isError || (code ?? 0) !== 0,
        finalText:
          finalText ||
          stderr.trim() ||
          "Claude Code did not return output. Make sure Claude is logged in.",
        stderr,
      })
    })
  })
}
