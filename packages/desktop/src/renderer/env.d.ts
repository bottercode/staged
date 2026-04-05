/// <reference types="vite/client" />

declare global {
  interface Window {
    api: {
      platform: string
      openFolder: () => Promise<string | null>
      getSettings: () => Promise<{ modelId: string; providerApiKeys: Record<string, string> }>
      setSettings: (s: { modelId: string; providerApiKeys: Record<string, string> }) => Promise<void>
      listModels: () => Promise<{ id: string; label: string }[]>
      runAgent: (payload: {
        jobId: string
        prompt: string
        cwd: string
        permissionMode: "edit" | "plan"
        history: unknown[]
      }) => Promise<{ ok: boolean }>
      stopAgent: (jobId: string) => Promise<void>
      onAgentEvent: (
        cb: (jobId: string, event: {
          type: "text" | "tool-call" | "tool-result" | "done" | "error"
          [key: string]: unknown
        }) => void
      ) => () => void
    }
  }
}

export {}
