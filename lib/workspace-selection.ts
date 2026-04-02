"use client"

export const WORKSPACE_SELECTION_STORAGE_KEY = "staged-workspace-selection-v1"

export function readSelectedWorkspaceId(): string | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem(WORKSPACE_SELECTION_STORAGE_KEY)
  const value = raw?.trim()
  return value || null
}

export function writeSelectedWorkspaceId(workspaceId: string | null) {
  if (typeof window === "undefined") return
  if (!workspaceId) {
    localStorage.removeItem(WORKSPACE_SELECTION_STORAGE_KEY)
  } else {
    localStorage.setItem(WORKSPACE_SELECTION_STORAGE_KEY, workspaceId)
  }
  window.dispatchEvent(new Event("staged-workspace-selection-updated"))
}
