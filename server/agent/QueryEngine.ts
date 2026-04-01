import path from "path"
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai"
import { TaskManager } from "@/server/agent/Task"
import type { Tools } from "@/server/agent/Tool"
import { buildToolset } from "@/server/agent/Tool"
import { getModel, type ProviderApiKeys } from "@/server/agent/models"
import { buildProjectContext } from "@/server/agent/project"
import {
  BASE_SYSTEM_PROMPT,
  buildProjectContextPrompt,
} from "@/server/agent/system-prompt"
import { createAgentTools } from "@/server/agent/tools"
import { compactMessages } from "@/server/agent/compaction"
import {
  createDefaultHooks,
  runAfterHooks,
  runBeforeHooks,
  runErrorHooks,
} from "@/server/agent/hooks"
import { logConversationEvent } from "@/server/agent/history"
import { resolveFallbackModelId } from "@/server/agent/models"

export type QueryEngineConfig = {
  projectPath: string | null
  modelId?: string
  providerApiKeys?: ProviderApiKeys
  maxSteps?: number
  conversationId?: string
  permissionMode?: "edit" | "plan"
}

export class QueryEngine {
  private readonly config: QueryEngineConfig
  private readonly taskManager: TaskManager

  constructor(config: QueryEngineConfig) {
    this.config = config
    this.taskManager = new TaskManager()
  }

  private resolvePath = (requestedPath: string) => {
    const basePath = this.config.projectPath || process.cwd()

    if (!requestedPath) {
      return basePath
    }

    const absolutePath = path.isAbsolute(requestedPath)
      ? path.resolve(requestedPath)
      : path.resolve(basePath, requestedPath)

    if (this.config.projectPath) {
      const rootPath = path.resolve(this.config.projectPath)
      const insideRoot =
        absolutePath === rootPath ||
        absolutePath.startsWith(`${rootPath}${path.sep}`)

      if (!insideRoot) {
        throw new Error("Path is outside the connected project")
      }
    }

    return absolutePath
  }

  private async buildSystemPrompt() {
    if (!this.config.projectPath) {
      return BASE_SYSTEM_PROMPT
    }

    try {
      const context = await buildProjectContext(this.config.projectPath)
      return buildProjectContextPrompt(
        this.config.projectPath,
        context.folderName,
        context.topLevelEntries,
        this.config.permissionMode
      )
    } catch {
      return BASE_SYSTEM_PROMPT
    }
  }

  private isPromptTooLongError(error: unknown) {
    if (!(error instanceof Error)) return false
    const msg = error.message.toLowerCase()
    return (
      msg.includes("prompt too long") ||
      msg.includes("maximum context length") ||
      msg.includes("context length") ||
      msg.includes("input is too long")
    )
  }

  private isStructuredOutputError(error: unknown) {
    if (!(error instanceof Error)) return false
    const msg = error.message.toLowerCase()
    return msg.includes("json") || msg.includes("structured output")
  }

  async run(messages: unknown[]) {
    const hooks = createDefaultHooks()
    const hookContext = {
      state: {
        modelId: this.config.modelId,
        projectPath: this.config.projectPath,
        conversationId: this.config.conversationId,
      },
    }

    try {
      const systemPrompt = await this.buildSystemPrompt()
      const safeMessages = ((messages as UIMessage[]) || []).filter(Boolean)
      const hookMessages = await runBeforeHooks(
        hooks,
        safeMessages,
        hookContext
      )
      const tools = buildToolset(
        createAgentTools(this.taskManager) as unknown as Tools,
        {
          projectPath: this.config.projectPath,
          resolvePath: this.resolvePath,
          defaultCwd: process.cwd(),
          permissionMode: this.config.permissionMode,
          onPermissionDenied: (toolName, reason) => {
            if (!this.config.conversationId) return
            void logConversationEvent(
              this.config.conversationId,
              "permission_denial",
              {
                toolName,
                reason,
              }
            )
          },
        }
      )

      const attemptPlan = [
        {
          label: "initial",
          mode: undefined as Parameters<typeof compactMessages>[1] | undefined,
          modelId: this.config.modelId,
        },
        {
          label: "prompt_too_long_reactive_compact_retry",
          mode: {
            microTokens: 8_000,
            autoTokens: 10_000,
            snipTokens: 12_000,
            reactiveTokens: 14_000,
          },
          modelId: this.config.modelId,
        },
        {
          label: "fallback_model_retry",
          mode: {
            microTokens: 7_000,
            autoTokens: 9_000,
            snipTokens: 11_000,
            reactiveTokens: 12_000,
          },
          modelId: resolveFallbackModelId(this.config.modelId),
        },
      ]

      let lastError: unknown = null

      for (let i = 0; i < attemptPlan.length; i++) {
        const step = attemptPlan[i]
        if (!step.modelId) continue
        try {
          const compacted = compactMessages(hookMessages, step.mode)
          if (compacted.compacted && this.config.conversationId) {
            void logConversationEvent(
              this.config.conversationId,
              "compaction",
              {
                mode: compacted.metadata?.mode,
                droppedMessages: compacted.metadata?.droppedMessages,
                attempt: step.label,
              }
            )
          }
          if (i > 0 && this.config.conversationId) {
            void logConversationEvent(this.config.conversationId, "status", {
              status: step.label,
            })
          }

          const modelMessages = await convertToModelMessages(compacted.messages)
          const result = streamText({
            model: getModel(step.modelId, this.config.providerApiKeys),
            system: systemPrompt,
            messages: modelMessages,
            stopWhen: stepCountIs(this.config.maxSteps ?? 15),
            tools,
            temperature: 0,
          })

          void runAfterHooks(hooks, hookContext)
          return result.toUIMessageStreamResponse({
            onError: (error) =>
              `Agent error: ${
                error instanceof Error
                  ? error.message
                  : "Unknown model/runtime error"
              }`,
            originalMessages: compacted.messages,
          })
        } catch (error) {
          lastError = error
          const canRetryPrompt = this.isPromptTooLongError(error)
          const canRetryStructured =
            step.label === "initial" && this.isStructuredOutputError(error)
          const willRetry =
            (step.label === "initial" &&
              (canRetryPrompt || canRetryStructured)) ||
            step.label === "prompt_too_long_reactive_compact_retry"

          if (!willRetry) break
          continue
        }
      }

      throw lastError instanceof Error
        ? lastError
        : new Error("Query engine failed to recover after retries.")
    } catch (error) {
      await runErrorHooks(hooks, error, hookContext)
      throw error
    }
  }
}
