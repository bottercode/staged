import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createMistral } from "@ai-sdk/mistral"
import { createXai } from "@ai-sdk/xai"
import type { LanguageModelV1 } from "ai"

export type ProviderKeys = {
  anthropicApiKey?: string
  openaiApiKey?: string
  googleApiKey?: string
  mistralApiKey?: string
  xaiApiKey?: string
}

export function getModel(modelId: string, keys: ProviderKeys): LanguageModelV1 {
  const [provider, ...rest] = modelId.split(":")
  const model = rest.join(":")

  switch (provider) {
    case "anthropic": {
      const apiKey = keys.anthropicApiKey || process.env.ANTHROPIC_API_KEY
      return createAnthropic({ apiKey })(
        model || "claude-sonnet-4-5-20251001"
      )
    }
    case "openai": {
      const apiKey = keys.openaiApiKey || process.env.OPENAI_API_KEY
      return createOpenAI({ apiKey })(model || "gpt-4o")
    }
    case "google": {
      const apiKey = keys.googleApiKey || process.env.GOOGLE_API_KEY
      return createGoogleGenerativeAI({ apiKey })(
        model || "gemini-2.0-flash-001"
      )
    }
    case "mistral": {
      const apiKey = keys.mistralApiKey || process.env.MISTRAL_API_KEY
      return createMistral({ apiKey })(model || "mistral-large-latest")
    }
    case "xai": {
      const apiKey = keys.xaiApiKey || process.env.XAI_API_KEY
      return createXai({ apiKey })(model || "grok-3-mini-fast-beta")
    }
    default:
      throw new Error(`Unknown model provider: ${provider}`)
  }
}

export const MODEL_OPTIONS = [
  { id: "anthropic:claude-sonnet-4-5-20251001", label: "Claude Sonnet 4.5" },
  { id: "anthropic:claude-opus-4-5", label: "Claude Opus 4.5" },
  { id: "openai:gpt-4o", label: "GPT-4o" },
  { id: "openai:o4-mini", label: "o4-mini" },
  { id: "google:gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
  { id: "xai:grok-3-mini-fast-beta", label: "Grok 3 Mini" },
]
