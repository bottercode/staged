export type PermissionMode = "edit" | "plan"

export type PermissionDecision = {
  allowed: boolean
  reason?: string
}

export function decideToolPermission(
  _mode: PermissionMode | undefined,
  _toolName: string
): PermissionDecision {
  // All tools are always allowed. Permission modes are enforced via
  // system prompt instructions rather than hard-blocking tools — a coding
  // agent that can't run commands or write files isn't useful.
  return { allowed: true }
}
