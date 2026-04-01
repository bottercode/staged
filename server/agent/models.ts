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

const OPENAI_PREFIXES = ["gpt-", "o", "chatgpt-", "deepseek-", "qwen-", "llama-"]
const GOOGLE_PREFIXES = ["gemini-"]
const MISTRAL_PREFIXES = ["mistral-", "codestral"]
const XAI_PREFIXES = ["grok-"]

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

export function inferProviderFromModel(model: string): ProviderName | null {
  if (model.startsWith("claude-")) return "anthropic"
  if (OPENAI_PREFIXES.some((prefix) => model.startsWith(prefix))) return "openai"
  if (GOOGLE_PREFIXES.some((prefix) => model.startsWith(prefix))) return "google"
  if (MISTRAL_PREFIXES.some((prefix) => model.startsWith(prefix))) return "mistral"
  if (XAI_PREFIXES.some((prefix) => model.startsWith(prefix))) return "xai"
  return null
}

export function resolveProviderFromModelId(modelId?: string): ProviderName | null {
  const selection = parseModelSelection(modelId)
  return selection.provider ?? inferProviderFromModel(selection.model)
}

export function resolveFallbackModelId(modelId?: string) {
  const selection = parseModelSelection(modelId)
  const model = selection.model
  const provider = selection.provider ?? inferProviderFromModel(model)
  if (!provider) return undefined

  if (provider === "anthropic") {
    if (model.includes("opus")) return "anthropic:claude-sonnet-4-20250514"
    return "anthropic:claude-haiku-4-20250414"
  }
  if (provider === "openai") {
    if (model.startsWith("gpt-4") || model === "o3") return "openai:gpt-4o-mini"
    return "openai:gpt-4.1-mini"
  }
  if (provider === "google") {
    return "google:gemini-2.5-flash"
  }
  if (provider === "mistral") {
    return "mistral:mistral-small-latest"
  }
  return "xai:grok-3-mini"
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
  const resolvedProvider =
    selection.provider ?? inferProviderFromModel(resolvedModel)
  const providers = getProviders(keys)

  if (!resolvedProvider) {
    throw new Error(
      `Unknown model "${resolvedModel}". Use provider:model, for example "google:gemini-2.5-flash".`
    )
  }

  if (resolvedProvider === "anthropic") return providers.anthropic(resolvedModel)
  if (resolvedProvider === "openai") return providers.openai(resolvedModel)
  if (resolvedProvider === "google") return providers.google(resolvedModel)
  if (resolvedProvider === "mistral") return providers.mistral(resolvedModel)
  return providers.xai(resolvedModel)
}
