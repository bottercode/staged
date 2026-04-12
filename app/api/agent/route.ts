import { randomUUID } from "crypto"
import { createUIMessageStream, createUIMessageStreamResponse } from "ai"
import { QueryEngine } from "@/server/agent/QueryEngine"
import { runAgentStream } from "@/server/agent/agent-runner"
import { logConversationEvent } from "@/server/agent/history"
import { estimateInputUsage, estimateRunCost } from "@/server/agent/cost"
import { touchSession } from "@/server/agent/sessions"
import { getAuthenticatedUserId } from "@/server/auth-user"

const CLAUDE_CLI_ALIASES = new Set(["sonnet", "opus", "haiku"])
const OPENAI_PREFIXES = [
  "gpt-",
  "o",
  "chatgpt-",
  "deepseek-",
  "qwen-",
  "llama-",
]
const GOOGLE_PREFIXES = ["gemini-"]
const MISTRAL_PREFIXES = ["mistral-", "codestral"]
const XAI_PREFIXES = ["grok-"]

type ProviderName = "anthropic" | "openai" | "google" | "mistral" | "xai"

type ProviderApiKeys = {
  anthropicApiKey?: string
  openaiApiKey?: string
  googleApiKey?: string
  mistralApiKey?: string
  xaiApiKey?: string
}

type SelectedTask = {
  id: string
  title: string
  description?: string | null
  priority?: string | null
  dueDate?: string | Date | null
  boardName?: string | null
  columnName?: string | null
  assigneeName?: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function normalizeSelectedTasks(value: unknown): SelectedTask[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item) => isRecord(item))
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : "",
      title: typeof item.title === "string" ? item.title : "",
      description:
        typeof item.description === "string" || item.description === null
          ? item.description
          : null,
      priority: typeof item.priority === "string" ? item.priority : null,
      dueDate:
        typeof item.dueDate === "string" ||
        item.dueDate instanceof Date ||
        item.dueDate === null
          ? item.dueDate
          : null,
      boardName: typeof item.boardName === "string" ? item.boardName : null,
      columnName: typeof item.columnName === "string" ? item.columnName : null,
      assigneeName:
        typeof item.assigneeName === "string" ? item.assigneeName : null,
    }))
    .filter((item) => item.id && item.title)
    .slice(0, 20)
}

function buildTaskContext(selectedTasks: SelectedTask[]) {
  if (selectedTasks.length === 0) return ""
  const lines = selectedTasks.map((task, index) => {
    const meta = [
      task.boardName ? `board=${task.boardName}` : null,
      task.columnName ? `status=${task.columnName}` : null,
      task.priority ? `priority=${task.priority}` : null,
      task.assigneeName ? `assignee=${task.assigneeName}` : null,
      task.dueDate ? `due=${String(task.dueDate)}` : null,
    ]
      .filter(Boolean)
      .join(", ")
    return `${index + 1}. ${task.title}${meta ? ` [${meta}]` : ""}${
      task.description ? `\n   ${task.description}` : ""
    }`
  })

  return `\n\nUse this live task-board context from Staged (already fetched by the app). Treat it as authoritative project task data. Do not say you cannot access the task board for these selected items.\n\nSelected tasks:\n${lines.join("\n")}\n`
}

function injectTaskContextIntoMessages(messages: unknown, context: string) {
  if (!Array.isArray(messages) || !context) return messages
  const next = [...messages]

  for (let i = next.length - 1; i >= 0; i--) {
    const message = next[i]
    if (!isRecord(message) || message.role !== "user") continue

    if (Array.isArray(message.parts)) {
      next[i] = {
        ...message,
        parts: [...message.parts, { type: "text", text: context }],
      }
      return next
    }

    if (typeof message.content === "string") {
      next[i] = {
        ...message,
        content: `${message.content}${context}`,
      }
      return next
    }
  }

  next.push({
    id: randomUUID(),
    role: "user",
    parts: [{ type: "text", text: context }],
  })
  return next
}

function normalizeModelId(modelId: unknown): string | undefined {
  if (typeof modelId !== "string") return undefined
  const normalized = modelId.trim()
  return normalized || undefined
}

function isCliRunnerModel(modelId?: string) {
  if (!modelId) return true
  const normalized = modelId.includes(":")
    ? modelId.split(":").slice(1).join(":").trim()
    : modelId
  const providerPrefix = modelId.includes(":")
    ? modelId.split(":")[0].trim()
    : ""

  if (providerPrefix && providerPrefix !== "anthropic") return false
  return normalized.startsWith("claude-") || CLAUDE_CLI_ALIASES.has(normalized)
}

function getModelWithoutProviderPrefix(modelId?: string) {
  if (!modelId) return ""
  return modelId.includes(":")
    ? modelId.split(":").slice(1).join(":").trim()
    : modelId
}

function resolveProvider(modelId?: string): ProviderName | null {
  if (!modelId) return null

  if (modelId.includes(":")) {
    const [provider] = modelId.split(":")
    if (
      provider === "anthropic" ||
      provider === "openai" ||
      provider === "google" ||
      provider === "mistral" ||
      provider === "xai"
    ) {
      return provider
    }
  }

  const normalized = getModelWithoutProviderPrefix(modelId)

  if (normalized.startsWith("claude-") || CLAUDE_CLI_ALIASES.has(normalized)) {
    return "anthropic"
  }
  if (OPENAI_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return "openai"
  }
  if (GOOGLE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return "google"
  }
  if (MISTRAL_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return "mistral"
  }
  if (XAI_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return "xai"
  }

  return null
}

function hasApiKey(provider: ProviderName, keys?: ProviderApiKeys) {
  const value =
    provider === "anthropic"
      ? keys?.anthropicApiKey
      : provider === "openai"
        ? keys?.openaiApiKey
        : provider === "google"
          ? keys?.googleApiKey
          : provider === "mistral"
            ? keys?.mistralApiKey
            : keys?.xaiApiKey
  return Boolean(value && value.trim())
}

function apiKeyError(provider: ProviderName) {
  return `Missing API key for ${provider}. Open Agent Settings (gear icon in sidebar) and add your ${provider} key.`
}

function errorStream(message: string) {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      const id = randomUUID()
      writer.write({ type: "start" })
      writer.write({ type: "text-start", id })
      writer.write({
        type: "text-delta",
        id,
        delta: `Agent error: ${message}`,
      })
      writer.write({ type: "text-end", id })
      writer.write({ type: "finish", finishReason: "error" })
    },
  })
  return createUIMessageStreamResponse({ stream })
}

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    return errorStream("Unauthorized. Please sign in again.")
  }

  const {
    messages,
    projectPath,
    modelId,
    conversationId,
    permissionMode,
    backend,
    providerApiKeys,
    selectedTasks,
  } = await req.json()
  const normalizedSelectedTasks = normalizeSelectedTasks(selectedTasks)
  const taskContext = buildTaskContext(normalizedSelectedTasks)
  const preparedMessages = injectTaskContextIntoMessages(
    messages,
    taskContext
  ) as unknown[]
  const normalizedConversationId =
    typeof conversationId === "string" && conversationId.trim()
      ? conversationId.trim()
      : randomUUID()
  const normalizedModelId = normalizeModelId(modelId)
  const resolvedProvider = resolveProvider(normalizedModelId)
  const keys = (providerApiKeys || {}) as ProviderApiKeys

  if (!normalizedModelId) {
    return errorStream(
      "No model selected. Please choose a model in the input bar before sending."
    )
  }

  if (!resolvedProvider) {
    return errorStream(
      `Unknown model format "${normalizedModelId}". Use provider:model (example: google:gemini-2.5-flash).`
    )
  }

  if (!hasApiKey(resolvedProvider, keys)) {
    return errorStream(apiKeyError(resolvedProvider))
  }

  void logConversationEvent(userId, normalizedConversationId, "turn_start", {
    modelId: normalizedModelId,
    provider: resolvedProvider,
    backend: backend ?? "auto",
    projectPath: typeof projectPath === "string" ? projectPath : null,
  })
  void touchSession(userId, normalizedConversationId, {
    projectPath: typeof projectPath === "string" ? projectPath : null,
    modelId: normalizedModelId,
  })

  const selectedBackend = (backend ?? "auto") as string
  const inputUsage = estimateInputUsage((preparedMessages || []) as unknown[])

  const shouldUseCliRunner =
    Boolean(projectPath) &&
    (selectedBackend === "auto" || selectedBackend === "claude-code") &&
    isCliRunnerModel(normalizedModelId)

  if (shouldUseCliRunner && projectPath) {
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        try {
          let textId: string | null = null
          let emittedText = ""

          const ensureTextChannel = () => {
            if (textId) return textId
            const nextId = randomUUID()
            textId = nextId
            writer.write({ type: "text-start", id: nextId })
            return nextId
          }

          writer.write({ type: "start" })

          const result = await runAgentStream(
            {
              messages: preparedMessages,
              projectPath,
              modelId: normalizedModelId,
              conversationId: normalizedConversationId,
              permissionMode:
                permissionMode === "edit" || permissionMode === "plan"
                  ? permissionMode
                  : "edit",
              providerApiKeys: keys,
              userId,
            },
            {
              onTextDelta: (delta) => {
                const id = ensureTextChannel()
                emittedText += delta
                writer.write({ type: "text-delta", id, delta })
              },
              onThinkingDelta: (delta) => {
                writer.write({
                  type: "data-agent_thinking",
                  data: { delta },
                  transient: true,
                })
              },
              onStatus: (status) => {
                void logConversationEvent(
                  userId,
                  normalizedConversationId,
                  "status",
                  {
                    status,
                  }
                )
                writer.write({
                  type: "data-agent_status",
                  data: { status },
                  transient: true,
                })
              },
              onToolInput: (toolCallId, toolName, input) => {
                void logConversationEvent(
                  userId,
                  normalizedConversationId,
                  "tool_input",
                  {
                    toolCallId,
                    toolName,
                  }
                )
                writer.write({
                  type: "tool-input-available",
                  toolCallId,
                  toolName,
                  input,
                })
              },
              onToolOutput: (toolCallId, output) => {
                void logConversationEvent(
                  userId,
                  normalizedConversationId,
                  "tool_output",
                  {
                    toolCallId,
                  }
                )
                writer.write({
                  type: "tool-output-available",
                  toolCallId,
                  output,
                })
              },
              onRawEvent: (event) => {
                writer.write({
                  type: "data-agent_event",
                  data: event,
                  transient: true,
                })
              },
            }
          )

          if (!emittedText.trim() && result.finalText.trim()) {
            const id = ensureTextChannel()
            writer.write({ type: "text-delta", id, delta: result.finalText })
          }

          void logConversationEvent(
            userId,
            normalizedConversationId,
            "turn_finish",
            {
              isError: result.isError,
              retryCount: result.retryCount,
              emittedTextLength: emittedText.length || result.emittedTextLength,
              usage: estimateRunCost({
                provider: resolvedProvider,
                inputTokens: inputUsage.inputTokens,
                outputTokens: Math.ceil(
                  (emittedText.length || result.emittedTextLength || 0) / 4
                ),
              }),
            }
          )

          if (textId) {
            writer.write({ type: "text-end", id: textId })
          }

          writer.write({
            type: "finish",
            finishReason: result.isError ? "error" : "stop",
          })
        } catch (error) {
          const errorText =
            error instanceof Error ? error.message : "Unknown error"
          console.error("[agent error]", errorText)
          void logConversationEvent(
            userId,
            normalizedConversationId,
            "turn_error",
            {
              errorText,
            }
          )
          writer.write({ type: "start" })
          const id = randomUUID()
          writer.write({ type: "text-start", id })
          writer.write({
            type: "text-delta",
            id,
            delta: `Agent error: ${errorText}`,
          })
          writer.write({ type: "text-end", id })
          writer.write({ type: "finish", finishReason: "error" })
        }
      },
    })

    return createUIMessageStreamResponse({ stream })
  }

  try {
    const engine = new QueryEngine({
      userId,
      projectPath: projectPath || null,
      modelId: normalizedModelId,
      providerApiKeys: keys,
      conversationId: normalizedConversationId,
      permissionMode:
        permissionMode === "edit" || permissionMode === "plan"
          ? permissionMode
          : "edit",
    })

    const response = await engine.run(preparedMessages)
    void logConversationEvent(userId, normalizedConversationId, "turn_finish", {
      isError: false,
      backend: "query_engine",
      usage: estimateRunCost({
        provider: resolvedProvider,
        inputTokens: inputUsage.inputTokens,
        outputTokens: 0,
      }),
    })
    return response
  } catch (error) {
    const errorText = error instanceof Error ? error.message : "Unknown error"
    console.error("[agent error]", errorText)
    void logConversationEvent(userId, normalizedConversationId, "turn_error", {
      error: errorText,
    })
    return errorStream(errorText)
  }
}
