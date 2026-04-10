"use client"

export type AgentProviderApiKeys = {
  anthropicApiKey?: string
  openaiApiKey?: string
  googleApiKey?: string
  mistralApiKey?: string
  xaiApiKey?: string
}

export const AGENT_SETTINGS_STORAGE_KEY = "staged-agent-settings-v1"

export type AgentSettings = {
  providerApiKeys: AgentProviderApiKeys
}

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  providerApiKeys: {},
}

function normalizeKey(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

export function readAgentSettings(): AgentSettings {
  if (typeof window === "undefined") return DEFAULT_AGENT_SETTINGS

  try {
    const raw = localStorage.getItem(AGENT_SETTINGS_STORAGE_KEY)
    if (!raw) return DEFAULT_AGENT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<AgentSettings> &
      Record<string, unknown>
    const nested =
      parsed.providerApiKeys &&
      typeof parsed.providerApiKeys === "object" &&
      parsed.providerApiKeys !== null
        ? (parsed.providerApiKeys as Record<string, unknown>)
        : {}
    const legacyApiKeys =
      parsed.apiKeys && typeof parsed.apiKeys === "object"
        ? (parsed.apiKeys as Record<string, unknown>)
        : {}

    return {
      providerApiKeys: {
        anthropicApiKey: normalizeKey(
          nested.anthropicApiKey ??
            legacyApiKeys.anthropicApiKey ??
            parsed.anthropicApiKey
        ),
        openaiApiKey: normalizeKey(
          nested.openaiApiKey ?? legacyApiKeys.openaiApiKey ?? parsed.openaiApiKey
        ),
        googleApiKey: normalizeKey(
          nested.googleApiKey ??
            legacyApiKeys.googleApiKey ??
            parsed.googleApiKey ??
            parsed.googleGenerativeAiApiKey ??
            parsed.GOOGLE_GENERATIVE_AI_API_KEY
        ),
        mistralApiKey: normalizeKey(
          nested.mistralApiKey ??
            legacyApiKeys.mistralApiKey ??
            parsed.mistralApiKey
        ),
        xaiApiKey: normalizeKey(
          nested.xaiApiKey ?? legacyApiKeys.xaiApiKey ?? parsed.xaiApiKey
        ),
      },
    }
  } catch {
    return DEFAULT_AGENT_SETTINGS
  }
}

export function writeAgentSettings(settings: AgentSettings) {
  if (typeof window === "undefined") return
  localStorage.setItem(AGENT_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  window.dispatchEvent(new Event("staged-agent-settings-updated"))
}
