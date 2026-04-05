import { ipcMain, dialog, app, BrowserWindow } from "electron"
import { join } from "path"
import fs from "fs/promises"
import { runAgent, type AgentJob } from "./agent"
import { MODEL_OPTIONS, type ProviderKeys } from "./models"

// ── Settings persistence ──────────────────────────────────────────────────────

const SETTINGS_PATH = join(app.getPath("userData"), "settings.json")

type Settings = {
  modelId: string
  providerApiKeys: ProviderKeys
}

const DEFAULT_SETTINGS: Settings = {
  modelId: "anthropic:claude-sonnet-4-5-20251001",
  providerApiKeys: {},
}

async function loadSettings(): Promise<Settings> {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf-8")
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

async function saveSettings(settings: Settings): Promise<void> {
  await fs.mkdir(join(app.getPath("userData")), { recursive: true })
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8")
}

// ── Active jobs ───────────────────────────────────────────────────────────────

type JobState = {
  job: AgentJob
  abort: AbortController
}

const activeJobs = new Map<string, JobState>()

// ── IPC handlers ──────────────────────────────────────────────────────────────

export function registerIpcHandlers(): void {
  // Open folder dialog
  ipcMain.handle("dialog:open-folder", async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      properties: ["openDirectory"],
      title: "Open Project Folder",
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // Settings
  ipcMain.handle("settings:get", async () => loadSettings())

  ipcMain.handle("settings:set", async (_e, settings: Settings) => {
    await saveSettings(settings)
    return true
  })

  ipcMain.handle("models:list", () => MODEL_OPTIONS)

  // Run agent job — streams events back via webContents.send
  ipcMain.handle(
    "agent:run",
    async (
      event,
      payload: {
        jobId: string
        prompt: string
        cwd: string
        permissionMode: "edit" | "plan"
        history: AgentJob["history"]
      }
    ) => {
      const settings = await loadSettings()

      const job: AgentJob = {
        jobId: payload.jobId,
        prompt: payload.prompt,
        modelId: settings.modelId,
        cwd: payload.cwd,
        permissionMode: payload.permissionMode,
        providerApiKeys: settings.providerApiKeys,
        history: payload.history,
      }

      const abort = new AbortController()
      activeJobs.set(payload.jobId, { job, abort })

      const sender = event.sender

      ;(async () => {
        try {
          for await (const agentEvent of runAgent(job, abort.signal)) {
            if (sender.isDestroyed()) break
            sender.send("agent:event", { jobId: payload.jobId, event: agentEvent })
            if (agentEvent.type === "done" || agentEvent.type === "error") break
          }
        } finally {
          activeJobs.delete(payload.jobId)
          if (!sender.isDestroyed()) {
            sender.send("agent:event", {
              jobId: payload.jobId,
              event: { type: "done", finalText: "" },
            })
          }
        }
      })()

      return { ok: true }
    }
  )

  // Stop agent job
  ipcMain.handle("agent:stop", (_e, jobId: string) => {
    const state = activeJobs.get(jobId)
    if (state) {
      state.abort.abort()
      activeJobs.delete(jobId)
    }
    return true
  })
}
