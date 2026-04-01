import { randomUUID } from "crypto"
import { createUIMessageStream, createUIMessageStreamResponse } from "ai"
import { QueryEngine } from "@/server/agent/QueryEngine"
import { runClaudeCodeStream } from "@/server/agent/claude-cli"

const CLAUDE_CLI_ALIASES = new Set(["sonnet", "opus", "haiku"])
const OPENAI_PREFIXES = ["gpt-", "o", "chatgpt-", "deepseek-", "qwen-", "llama-"]
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

function normalizeModelId(modelId: unknown): string | undefined {
  if (typeof modelId !== "string") return undefined
  const normalized = modelId.trim()
  return normalized || undefined
}

function isClaudeCliModel(modelId?: string) {
  if (!modelId) return true
  const normalized = modelId.includes(":")
    ? modelId.split(":").slice(1).join(":").trim()
    : modelId
  const providerPrefix = modelId.includes(":")
    ? modelId.split(":")[0].trim()
    : ""

  if (providerPrefix && providerPrefix !== "anthropic") return false
  return (
    normalized.startsWith("claude-") ||
    CLAUDE_CLI_ALIASES.has(normalized)
  )
}

function getModelWithoutProviderPrefix(modelId?: string) {
  if (!modelId) return ""
  return modelId.includes(":")
    ? modelId.split(":").slice(1).join(":").trim()
    : modelId
}

function resolveProvider(modelId?: string): ProviderName {
  if (!modelId) return "anthropic"

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

  return "anthropic"
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
  const {
    messages,
    projectPath,
    modelId,
    conversationId,
    backend,
    providerApiKeys,
  } = await req.json()
  const normalizedModelId = normalizeModelId(modelId)
  const resolvedProvider = resolveProvider(normalizedModelId)
  const keys = (providerApiKeys || {}) as ProviderApiKeys

  if (!hasApiKey(resolvedProvider, keys)) {
    return errorStream(apiKeyError(resolvedProvider))
  }

  const selectedBackend = (backend ?? "auto") as string

  const shouldUseClaudeCli =
    Boolean(projectPath) &&
    (selectedBackend === "auto" || selectedBackend === "claude-code") &&
    isClaudeCliModel(normalizedModelId)

  if (shouldUseClaudeCli && projectPath) {
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

          const result = await runClaudeCodeStream(
            {
              messages,
              projectPath,
              modelId: getModelWithoutProviderPrefix(normalizedModelId),
              conversationId,
            },
            {
              onTextDelta: (delta) => {
                const id = ensureTextChannel()
                emittedText += delta
                writer.write({ type: "text-delta", id, delta })
              },
              onToolInput: (toolCallId, toolName, input) => {
                writer.write({
                  type: "tool-input-available",
                  toolCallId,
                  toolName,
                  input,
                })
              },
              onToolOutput: (toolCallId, output) => {
                writer.write({
                  type: "tool-output-available",
                  toolCallId,
                  output,
                })
              },
              onRawEvent: (event) => {
                writer.write({
                  type: "data-claude_event",
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
          writer.write({ type: "start" })
          const id = randomUUID()
          writer.write({ type: "text-start", id })
          writer.write({ type: "text-delta", id, delta: `Agent error: ${errorText}` })
          writer.write({ type: "text-end", id })
          writer.write({ type: "finish", finishReason: "error" })
        }
      },
    })

    return createUIMessageStreamResponse({ stream })
  }

  try {
    const engine = new QueryEngine({
      projectPath: projectPath || null,
      modelId: normalizedModelId,
      providerApiKeys: keys,
    })

    return await engine.run(messages)
  } catch (error) {
    return errorStream(
      error instanceof Error ? error.message : "Unknown error"
    )
  }
}
