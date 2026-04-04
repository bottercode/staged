import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createMistral } from "@ai-sdk/mistral"
import { createOpenAI } from "@ai-sdk/openai"
import { createXai } from "@ai-sdk/xai"

export type ProviderKeys = {
  anthropicApiKey?: string
  openaiApiKey?: string
  googleApiKey?: string
  mistralApiKey?: string
  xaiApiKey?: string
}

const MODEL_ALIASES: Record<string, string> = {
  sonnet: "claude-sonnet-4-20250514",
  opus: "claude-opus-4-20250514",
  haiku: "claude-haiku-4-20250414",
}

const OPENAI_PREFIXES = ["gpt-", "o1", "o3", "o4", "chatgpt-", "deepseek-", "qwen-", "llama-"]
const GOOGLE_PREFIXES = ["gemini-"]
const MISTRAL_PREFIXES = ["mistral-", "codestral"]
const XAI_PREFIXES = ["grok-"]

function resolveProviderAndModel(modelId: string): { provider: string; model: string } {
  // Explicit provider prefix e.g. "google:gemini-2.5-flash"
  if (modelId.includes(":")) {
    const [provider, ...rest] = modelId.split(":")
    return { provider: provider!, model: rest.join(":").trim() }
  }
  // Alias e.g. "sonnet" → full model id
  const resolved = MODEL_ALIASES[modelId] ?? modelId

  if (resolved.startsWith("claude-")) return { provider: "anthropic", model: resolved }
  if (OPENAI_PREFIXES.some((p) => resolved.startsWith(p))) return { provider: "openai", model: resolved }
  if (GOOGLE_PREFIXES.some((p) => resolved.startsWith(p))) return { provider: "google", model: resolved }
  if (MISTRAL_PREFIXES.some((p) => resolved.startsWith(p))) return { provider: "mistral", model: resolved }
  if (XAI_PREFIXES.some((p) => resolved.startsWith(p))) return { provider: "xai", model: resolved }

  // Default to anthropic for unknown models
  return { provider: "anthropic", model: resolved }
}

export function getModel(modelId: string, keys: ProviderKeys) {
  const { provider, model } = resolveProviderAndModel(modelId)

  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey: keys.anthropicApiKey })(model)
    case "openai":
      return createOpenAI({ apiKey: keys.openaiApiKey })(model)
    case "google":
      return createGoogleGenerativeAI({ apiKey: keys.googleApiKey })(model)
    case "mistral":
      return createMistral({ apiKey: keys.mistralApiKey })(model)
    case "xai":
      return createXai({ apiKey: keys.xaiApiKey })(model)
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}
