import { contextBridge, ipcRenderer } from "electron";
const api = {
  platform: process.platform,
  openFolder: () => ipcRenderer.invoke("dialog:open-folder"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (s) => ipcRenderer.invoke("settings:set", s),
  listModels: () => ipcRenderer.invoke("models:list"),
  getGitBranch: (cwd) => ipcRenderer.invoke("agent:git-branch", cwd),
  runAgent: (payload) => ipcRenderer.invoke("agent:run", payload),
  stopAgent: (jobId) => ipcRenderer.invoke("agent:stop", jobId),
  onAgentEvent: (cb) => {
    const handler = (_, data) => cb(data.jobId, data.event);
    ipcRenderer.on("agent:event", handler);
    return () => ipcRenderer.off("agent:event", handler);
  },
  onAuthStarted: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("auth:started", handler);
    return () => ipcRenderer.off("auth:started", handler);
  },
  onAuthComplete: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("auth:complete", handler);
    return () => ipcRenderer.off("auth:complete", handler);
  },
  onSectionSwitch: (cb) => {
    const handler = (_, section) => cb(section);
    ipcRenderer.on("section:switch", handler);
    return () => ipcRenderer.off("section:switch", handler);
  },
  checkAuth: () => ipcRenderer.invoke("auth:check"),
  signIn: () => ipcRenderer.invoke("auth:sign-in"),
  onUpdateAvailable: (cb) => {
    const handler = (_, update) => cb(update);
    ipcRenderer.on("update:available", handler);
    return () => ipcRenderer.off("update:available", handler);
  },
  downloadUpdate: (url) => ipcRenderer.invoke("update:download", url)
};
contextBridge.exposeInMainWorld("api", api);
