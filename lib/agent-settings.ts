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

export function readAgentSettings(): AgentSettings {
  if (typeof window === "undefined") return DEFAULT_AGENT_SETTINGS

  try {
    const raw = localStorage.getItem(AGENT_SETTINGS_STORAGE_KEY)
    if (!raw) return DEFAULT_AGENT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<AgentSettings>
    return {
      providerApiKeys: {
        ...DEFAULT_AGENT_SETTINGS.providerApiKeys,
        ...(parsed.providerApiKeys || {}),
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

