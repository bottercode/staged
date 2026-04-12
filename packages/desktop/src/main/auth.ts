import { app, BrowserWindow, session, shell } from "electron"

export const BASE_URL = app.isPackaged
  ? "https://staged.codula.in"
  : "http://localhost:3000"

export function isAuthComplete(url: string): boolean {
  return (
    url.startsWith(BASE_URL) &&
    !url.includes("/api/auth") &&
    !url.includes("/auth/signin") &&
    !url.includes("/auth/desktop-success")
  )
}

export async function checkSession(): Promise<boolean> {
  try {
    const sess = session.fromPartition("persist:webapp")
    const res = await sess.fetch(`${BASE_URL}/api/auth/session`)
    const data = (await res.json()) as { user?: unknown }
    return !!data?.user
  } catch {
    return false
  }
}

/** Exchange the desktop auth code for a session cookie in the persist:webapp partition. */
export async function exchangeDesktopCode(code: string): Promise<boolean> {
  try {
    const sess = session.fromPartition("persist:webapp")
    const res = await sess.fetch(
      `${BASE_URL}/api/auth/desktop-exchange?code=${encodeURIComponent(code)}`
    )
    return res.ok
  } catch {
    return false
  }
}

/** Open the system browser to sign in. After sign-in, the server redirects to staged://auth?code=xxx */
export function openBrowserSignIn(): void {
  const callbackUrl = encodeURIComponent("/api/auth/desktop-callback")
  shell.openExternal(
    `${BASE_URL}/auth/signin?callbackUrl=${callbackUrl}`
  )
}
