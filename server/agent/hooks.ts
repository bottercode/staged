import type { UIMessage } from "ai"

export type AgentRuntimeState = {
  modelId?: string
  projectPath: string | null
  conversationId?: string
}

export type AgentRuntimeHookContext = {
  state: AgentRuntimeState
}

export type AgentRuntimeHook = {
  name: string
  beforeRun?: (messages: UIMessage[], context: AgentRuntimeHookContext) => Promise<UIMessage[]>
  afterRun?: (context: AgentRuntimeHookContext) => Promise<void>
  onError?: (error: unknown, context: AgentRuntimeHookContext) => Promise<void>
}

export function createDefaultHooks(): AgentRuntimeHook[] {
  return [
    {
      name: "message-sanity",
      beforeRun: async (messages) => messages.filter(Boolean),
    },
  ]
}

export async function runBeforeHooks(
  hooks: AgentRuntimeHook[],
  messages: UIMessage[],
  context: AgentRuntimeHookContext
) {
  let next = messages
  for (const hook of hooks) {
    if (!hook.beforeRun) continue
    next = await hook.beforeRun(next, context)
  }
  return next
}

export async function runAfterHooks(
  hooks: AgentRuntimeHook[],
  context: AgentRuntimeHookContext
) {
  for (const hook of hooks) {
    if (!hook.afterRun) continue
    await hook.afterRun(context)
  }
}

export async function runErrorHooks(
  hooks: AgentRuntimeHook[],
  error: unknown,
  context: AgentRuntimeHookContext
) {
  for (const hook of hooks) {
    if (!hook.onError) continue
    await hook.onError(error, context)
  }
}

