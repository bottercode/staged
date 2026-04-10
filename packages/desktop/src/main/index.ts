import { app, BrowserWindow, shell, ipcMain } from "electron"
import { join } from "path"
import { registerIpcHandlers } from "./ipc"
import { BASE_URL, exchangeDesktopCode } from "./auth"

const CURRENT_VERSION = app.getVersion()
const RELEASE_BASE = "https://github.com/bottercode/staged/releases/latest/download"

function getDownloadUrl(): string {
  const p = process.platform
  if (p === "win32") return `${RELEASE_BASE}/Staged-win.exe`
  if (p === "linux") return `${RELEASE_BASE}/Staged-linux.AppImage`
  const arch = process.arch === "arm64" ? "arm64" : "x64"
  return `${RELEASE_BASE}/Staged-mac-${arch}.dmg`
}

async function checkForUpdate(): Promise<{ version: string; downloadUrl: string } | null> {
  try {
    const res = await fetch("https://api.github.com/repos/bottercode/staged/releases/latest", {
      headers: { "User-Agent": "staged-desktop" },
    })
    if (!res.ok) return null
    const data = await res.json() as { tag_name?: string }
    const latest = data.tag_name?.replace(/^v/, "")
    if (!latest || latest === CURRENT_VERSION) return null
    // Simple semver: compare dot-separated numbers
    const toNum = (v: string) => v.split(".").map(Number)
    const [lMaj, lMin, lPat] = toNum(latest)
    const [cMaj, cMin, cPat] = toNum(CURRENT_VERSION)
    const isNewer =
      lMaj > cMaj ||
      (lMaj === cMaj && lMin > cMin) ||
      (lMaj === cMaj && lMin === cMin && lPat > cPat)
    if (!isNewer) return null
    return { version: latest, downloadUrl: getDownloadUrl() }
  } catch {
    return null
  }
}

// Register staged:// as a deep-link protocol handler
if (process.defaultApp) {
  // Dev mode: register with the electron executable + script path
  app.setAsDefaultProtocolClient("staged", process.execPath, [
    join(__dirname, "../../.."),
  ])
} else {
  app.setAsDefaultProtocolClient("staged")
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 700,
    minHeight: 500,
    backgroundColor: "#0a0a0a",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
    show: false,
  })

  win.once("ready-to-show", () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: "deny" }
  })

  if (process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"])
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"))
  }

  return win
}

async function handleDeepLink(url: string) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "staged:") return
    const code = parsed.searchParams.get("code")
    if (!code) return

    await exchangeDesktopCode(code)

    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send("auth:complete")
    })
  } catch {
    // ignore malformed URLs
  }
}

// macOS: deep link received while app is running
app.on("open-url", (event, url) => {
  event.preventDefault()
  void handleDeepLink(url)
})

// Windows: deep link received via second instance
app.on("second-instance", (_event, argv) => {
  const url = argv.find((arg) => arg.startsWith("staged://"))
  if (url) void handleDeepLink(url)

  const win = BrowserWindow.getAllWindows()[0]
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

// Prevent launching a second instance on Windows/Linux
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()

// Intercept Google OAuth navigations from webviews — redirect to sign-in page instead
app.on("web-contents-created", (_event, contents) => {
  if (contents.getType() !== "webview") return

  contents.on("will-navigate", (navEvent, url) => {
    const isOAuthUrl =
      url.includes("accounts.google.com") ||
      url.includes(`${BASE_URL}/api/auth/signin/google`) ||
      url.includes("/api/auth/signin/google")

    if (!isOAuthUrl) return
    navEvent.preventDefault()

    // Let the renderer show the waiting overlay (auth:started is sent from here)
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send("auth:started")
    })
  })

  // SPA navigation (pushState) — inform renderer of section changes
  contents.on("did-navigate-in-page", (_, url) => {
    if (url.includes("/workspace/agent")) {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) win.webContents.send("section:switch", "agent")
      })
    }
  })

  // If webview lands on sign-in page, intercept — open browser instead
  contents.on("did-navigate", (_, url) => {
    if (url.startsWith(`${BASE_URL}/auth/signin`)) {
      const { openBrowserSignIn } = require("./auth") as typeof import("./auth")
      openBrowserSignIn()
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) win.webContents.send("auth:started")
      })
    }
  })
})

app.whenReady().then(() => {
  registerIpcHandlers()

  ipcMain.handle("update:check", async () => checkForUpdate())

  ipcMain.handle("update:download", (_e, url: string) => {
    shell.openExternal(url)
    return { ok: true }
  })

  const win = createWindow()

  // Check for update 5s after launch so it doesn't block startup (skip in dev)
  if (app.isPackaged) {
    setTimeout(() => {
      void checkForUpdate().then((update) => {
        if (update && !win.isDestroyed()) {
          win.webContents.send("update:available", update)
        }
      })
    }, 5000)
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
