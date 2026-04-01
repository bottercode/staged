import { anthropic, createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI, google } from "@ai-sdk/google"
import { createMistral, mistral } from "@ai-sdk/mistral"
import { createOpenAI, openai } from "@ai-sdk/openai"
import { createXai, xai } from "@ai-sdk/xai"

export const DEFAULT_MODEL_ID = "claude-sonnet-4-20250514"
const MODEL_ALIASES: Record<string, string> = {
  sonnet: "claude-sonnet-4-20250514",
  opus: "claude-opus-4-20250514",
  haiku: "claude-haiku-4-20250414",
}

export type ProviderApiKeys = {
  anthropicApiKey?: string
  openaiApiKey?: string
  googleApiKey?: string
  mistralApiKey?: string
  xaiApiKey?: string
}

type ProviderName = "anthropic" | "openai" | "google" | "mistral" | "xai"

function parseModelSelection(modelId?: string): {
  provider?: ProviderName
  model: string
} {
  const resolvedModel = MODEL_ALIASES[modelId || ""] || modelId || DEFAULT_MODEL_ID

  if (resolvedModel.includes(":")) {
    const [provider, ...rest] = resolvedModel.split(":")
    const model = rest.join(":").trim()
    if (
      model &&
      (provider === "anthropic" ||
        provider === "openai" ||
        provider === "google" ||
        provider === "mistral" ||
        provider === "xai")
    ) {
      return { provider, model }
    }
  }

  return { model: resolvedModel }
}

function getProviders(keys?: ProviderApiKeys) {
  return {
    anthropic: keys?.anthropicApiKey
      ? createAnthropic({ apiKey: keys.anthropicApiKey })
      : anthropic,
    openai: keys?.openaiApiKey
      ? createOpenAI({ apiKey: keys.openaiApiKey })
      : openai,
    google: keys?.googleApiKey
      ? createGoogleGenerativeAI({ apiKey: keys.googleApiKey })
      : google,
    mistral: keys?.mistralApiKey
      ? createMistral({ apiKey: keys.mistralApiKey })
      : mistral,
    xai: keys?.xaiApiKey ? createXai({ apiKey: keys.xaiApiKey }) : xai,
  }
}

export function getModel(modelId?: string, keys?: ProviderApiKeys) {
  const selection = parseModelSelection(modelId)
  const resolvedModel = selection.model
  const providers = getProviders(keys)

  if (selection.provider === "anthropic") return providers.anthropic(resolvedModel)
  if (selection.provider === "openai") return providers.openai(resolvedModel)
  if (selection.provider === "google") return providers.google(resolvedModel)
  if (selection.provider === "mistral") return providers.mistral(resolvedModel)
  if (selection.provider === "xai") return providers.xai(resolvedModel)

  if (resolvedModel.startsWith("claude-")) return providers.anthropic(resolvedModel)

  if (
    resolvedModel.startsWith("gpt-") ||
    resolvedModel.startsWith("o") ||
    resolvedModel.startsWith("chatgpt-") ||
    resolvedModel.startsWith("deepseek-") ||
    resolvedModel.startsWith("qwen-") ||
    resolvedModel.startsWith("llama-")
  ) {
    return providers.openai(resolvedModel)
  }

  if (resolvedModel.startsWith("gemini-")) return providers.google(resolvedModel)

  if (
    resolvedModel.startsWith("mistral-") ||
    resolvedModel.startsWith("codestral")
  ) {
    return providers.mistral(resolvedModel)
  }

  if (resolvedModel.startsWith("grok-")) return providers.xai(resolvedModel)

  return providers.anthropic(DEFAULT_MODEL_ID)
}
