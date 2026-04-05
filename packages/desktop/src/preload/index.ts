import { contextBridge, ipcRenderer } from "electron"
import type { AgentEvent } from "../main/agent"

export type IpcApi = {
  platform: NodeJS.Platform
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
    cb: (jobId: string, event: AgentEvent) => void
  ) => () => void
}

const api: IpcApi = {
  platform: process.platform,
  openFolder: () => ipcRenderer.invoke("dialog:open-folder"),

  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (s) => ipcRenderer.invoke("settings:set", s),
  listModels: () => ipcRenderer.invoke("models:list"),

  runAgent: (payload) => ipcRenderer.invoke("agent:run", payload),
  stopAgent: (jobId) => ipcRenderer.invoke("agent:stop", jobId),

  onAgentEvent: (cb) => {
    const handler = (
      _: Electron.IpcRendererEvent,
      data: { jobId: string; event: AgentEvent }
    ) => cb(data.jobId, data.event)
    ipcRenderer.on("agent:event", handler)
    return () => ipcRenderer.off("agent:event", handler)
  },
}

contextBridge.exposeInMainWorld("api", api)
