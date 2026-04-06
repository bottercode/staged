// Shared in-memory store for desktop OAuth codes.
// Works on single-instance deployments (Render.com).
// Each code is single-use and expires in 5 minutes.

const codes = new Map<string, { token: string; expires: number }>()

export function storeDesktopCode(code: string, token: string): void {
  codes.set(code, { token, expires: Date.now() + 5 * 60 * 1000 })
  // Prune expired entries
  for (const [k, v] of codes.entries()) {
    if (v.expires < Date.now()) codes.delete(k)
  }
}

export function consumeDesktopCode(code: string): string | null {
  const entry = codes.get(code)
  if (!entry || entry.expires < Date.now()) {
    codes.delete(code)
    return null
  }
  codes.delete(code) // one-time use
  return entry.token
}
