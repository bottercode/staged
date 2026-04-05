import { contextBridge, ipcRenderer } from "electron";
const api = {
  openFolder: () => ipcRenderer.invoke("dialog:open-folder"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (s) => ipcRenderer.invoke("settings:set", s),
  listModels: () => ipcRenderer.invoke("models:list"),
  runAgent: (payload) => ipcRenderer.invoke("agent:run", payload),
  stopAgent: (jobId) => ipcRenderer.invoke("agent:stop", jobId),
  onAgentEvent: (cb) => {
    const handler = (_, data) => cb(data.jobId, data.event);
    ipcRenderer.on("agent:event", handler);
    return () => ipcRenderer.off("agent:event", handler);
  }
};
contextBridge.exposeInMainWorld("api", api);
