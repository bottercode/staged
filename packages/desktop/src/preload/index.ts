import { contextBridge, ipcRenderer } from "electron"
import type { AgentEvent } from "../main/agent"

export type IpcApi = {
  platform: NodeJS.Platform
  openFolder: () => Promise<string | null>
  getSettings: () => Promise<{ modelId: string; providerApiKeys: Record<string, string> }>
  setSettings: (s: { modelId: string; providerApiKeys: Record<string, string> }) => Promise<void>
  listModels: () => Promise<{ id: string; label: string }[]>
  getGitBranch: (cwd: string) => Promise<{ branch: string | null; isGit: boolean }>
  runAgent: (payload: {
    jobId: string
    prompt: string
    cwd: string
    permissionMode: "edit" | "plan"
    history: unknown[]
    modelId?: string
  }) => Promise<{ ok: boolean }>
  stopAgent: (jobId: string) => Promise<void>
  onAgentEvent: (
    cb: (jobId: string, event: AgentEvent) => void
  ) => () => void
  onAuthStarted: (cb: () => void) => () => void
  onAuthComplete: (cb: () => void) => () => void
  onSectionSwitch: (cb: (section: string) => void) => () => void
  checkAuth: () => Promise<{ authenticated: boolean }>
  signIn: () => Promise<{ ok: boolean }>
}

const api: IpcApi = {
  platform: process.platform,
  openFolder: () => ipcRenderer.invoke("dialog:open-folder"),

  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (s) => ipcRenderer.invoke("settings:set", s),
  listModels: () => ipcRenderer.invoke("models:list"),
  getGitBranch: (cwd) => ipcRenderer.invoke("agent:git-branch", cwd),

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

  onAuthStarted: (cb) => {
    const handler = () => cb()
    ipcRenderer.on("auth:started", handler)
    return () => ipcRenderer.off("auth:started", handler)
  },

  onAuthComplete: (cb) => {
    const handler = () => cb()
    ipcRenderer.on("auth:complete", handler)
    return () => ipcRenderer.off("auth:complete", handler)
  },

  onSectionSwitch: (cb) => {
    const handler = (_: Electron.IpcRendererEvent, section: string) => cb(section)
    ipcRenderer.on("section:switch", handler)
    return () => ipcRenderer.off("section:switch", handler)
  },

  checkAuth: () => ipcRenderer.invoke("auth:check"),
  signIn: () => ipcRenderer.invoke("auth:sign-in"),
}

contextBridge.exposeInMainWorld("api", api)
