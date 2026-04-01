import { tool } from "ai"
import type { z } from "zod"
import { decideToolPermission } from "@/server/agent/permissions"

export type ToolUseContext = {
  projectPath: string | null
  resolvePath: (requestedPath: string) => string
  defaultCwd: string
  permissionMode?: "edit" | "plan"
  onPermissionDenied?: (toolName: string, reason: string) => void
}

type ToolExecutor<TInput> = {
  bivarianceHack: (
    input: TInput,
    context: ToolUseContext
  ) => Promise<unknown> | unknown
}["bivarianceHack"]

export type ToolDefinition<TSchema extends z.ZodTypeAny = z.ZodTypeAny> = {
  name: string
  description: string
  inputSchema: TSchema
  execute: ToolExecutor<z.infer<TSchema>>
}

export type AnyToolDefinition = ToolDefinition<z.ZodTypeAny>
export type Tools = AnyToolDefinition[]

export function defineTool<TSchema extends z.ZodTypeAny>(
  definition: ToolDefinition<TSchema>
) {
  return definition
}

export function buildToolset(tools: Tools, context: ToolUseContext) {
  return Object.fromEntries(
    tools.map((definition) => [
      definition.name,
      tool({
        description: definition.description,
        inputSchema: definition.inputSchema,
        execute: async (input) => {
          const decision = decideToolPermission(
            context.permissionMode,
            definition.name
          )
          if (!decision.allowed) {
            context.onPermissionDenied?.(
              definition.name,
              decision.reason || "Permission denied"
            )
            return { error: decision.reason || "Permission denied" }
          }
          return definition.execute(
            definition.inputSchema.parse(input),
            context
          )
        },
      }),
    ])
  )
}
