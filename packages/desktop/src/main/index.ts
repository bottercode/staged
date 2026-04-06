import { app, BrowserWindow, shell } from "electron"
import { join } from "path"
import { registerIpcHandlers } from "./ipc"
import { BASE_URL, exchangeDesktopCode } from "./auth"

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
    // Intercept webapp's Agent nav → switch to desktop agent section instead
    if (url.includes("/workspace/agent")) {
      navEvent.preventDefault()
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) win.webContents.send("section:switch", "agent")
      })
      return
    }

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

  // SPA navigation (pushState) — will-navigate doesn't fire for these
  contents.on("did-navigate-in-page", (_, url) => {
    if (url.includes("/workspace/agent")) {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) win.webContents.send("section:switch", "agent")
      })
      // Navigate back so the webview doesn't sit on the agent page
      if (contents.canGoBack()) {
        contents.goBack()
      } else {
        void contents.loadURL(`${BASE_URL}/workspace`)
      }
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
  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
