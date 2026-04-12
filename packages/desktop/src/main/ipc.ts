import { ipcMain, dialog, app, BrowserWindow } from "electron"
import { join } from "path"
import fs from "fs/promises"
import { exec } from "child_process"
import { promisify } from "util"
import { runAgent, type AgentJob } from "./agent"
import { MODEL_OPTIONS, type ProviderKeys } from "./models"
import { shell } from "electron"
import { BASE_URL, checkSession, openBrowserSignIn } from "./auth"

const execAsync = promisify(exec)

// ── Settings persistence ──────────────────────────────────────────────────────

const SETTINGS_PATH = join(app.getPath("userData"), "settings.json")
const SESSION_PATH = join(app.getPath("userData"), "session.json")

type PersistedSession = {
  cwd: string | null
  messages: unknown[]
  history: unknown[]
}

const EMPTY_SESSION: PersistedSession = { cwd: null, messages: [], history: [] }

async function loadSession(): Promise<PersistedSession> {
  try {
    const raw = await fs.readFile(SESSION_PATH, "utf-8")
    const parsed = JSON.parse(raw) as Partial<PersistedSession>
    return {
      cwd: typeof parsed.cwd === "string" ? parsed.cwd : null,
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
    }
  } catch {
    return { ...EMPTY_SESSION }
  }
}

async function saveSession(session: PersistedSession): Promise<void> {
  await fs.mkdir(join(app.getPath("userData")), { recursive: true })
  await fs.writeFile(SESSION_PATH, JSON.stringify(session), "utf-8")
}

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

  // Agent session persistence (cwd + messages + history)
  ipcMain.handle("session:get", async () => loadSession())
  ipcMain.handle("session:set", async (_e, session: PersistedSession) => {
    await saveSession(session)
    return true
  })
  ipcMain.handle("session:clear", async () => {
    await saveSession({ ...EMPTY_SESSION })
    return true
  })

  ipcMain.handle("models:list", () => MODEL_OPTIONS)

  // Auth: check if user has a valid session
  ipcMain.handle("auth:check", async () => {
    const authenticated = await checkSession()
    return { authenticated }
  })

  // Auth: open the system browser for sign-in
  ipcMain.handle("auth:sign-in", () => {
    openBrowserSignIn()
    return { ok: true }
  })

  // Git branch for current directory
  ipcMain.handle("agent:git-branch", async (_e, cwd: string) => {
    try {
      const { stdout } = await execAsync("git branch --show-current", { cwd })
      const branch = stdout.trim()
      return { branch: branch || null, isGit: true }
    } catch {
      return { branch: null, isGit: false }
    }
  })

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
        modelId?: string
      }
    ) => {
      const settings = await loadSettings()

      const job: AgentJob = {
        jobId: payload.jobId,
        prompt: payload.prompt,
        modelId: payload.modelId || settings.modelId,
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
