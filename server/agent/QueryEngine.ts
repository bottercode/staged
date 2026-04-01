import path from "path"
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai"
import { TaskManager } from "@/server/agent/Task"
import type { Tools } from "@/server/agent/Tool"
import { buildToolset } from "@/server/agent/Tool"
import { getModel, type ProviderApiKeys } from "@/server/agent/models"
import { buildProjectContext } from "@/server/agent/project"
import { BASE_SYSTEM_PROMPT, buildProjectContextPrompt } from "@/server/agent/system-prompt"
import { createAgentTools } from "@/server/agent/tools"

export type QueryEngineConfig = {
  projectPath: string | null
  modelId?: string
  providerApiKeys?: ProviderApiKeys
  maxSteps?: number
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
        absolutePath === rootPath || absolutePath.startsWith(`${rootPath}${path.sep}`)

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
        context.topLevelEntries
      )
    } catch {
      return BASE_SYSTEM_PROMPT
    }
  }

  async run(messages: unknown[]) {
    const systemPrompt = await this.buildSystemPrompt()
    const modelMessages = await convertToModelMessages(messages as UIMessage[])

    const tools = buildToolset(createAgentTools(this.taskManager) as unknown as Tools, {
      projectPath: this.config.projectPath,
      resolvePath: this.resolvePath,
      defaultCwd: process.cwd(),
    })

    const result = streamText({
      model: getModel(this.config.modelId, this.config.providerApiKeys),
      system: systemPrompt,
      messages: modelMessages,
      stopWhen: stepCountIs(this.config.maxSteps ?? 15),
      tools,
    })

    return result.toUIMessageStreamResponse({
      onError: (error) =>
        `Agent error: ${
          error instanceof Error ? error.message : "Unknown model/runtime error"
        }`,
    })
  }
}
