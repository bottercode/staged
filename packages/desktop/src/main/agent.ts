import { streamText, stepCountIs } from "ai"
import type { ModelMessage } from "ai"
import { getModel, type ProviderKeys } from "./models"
import { buildTools } from "./tools"

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool-call"; id: string; name: string; input: unknown }
  | { type: "tool-result"; id: string; name: string; output: string }
  | { type: "done"; finalText: string }
  | { type: "error"; message: string }

export type AgentJob = {
  jobId: string
  prompt: string
  modelId: string
  cwd: string
  permissionMode: "edit" | "plan"
  providerApiKeys: ProviderKeys
  history: ModelMessage[]
}

function buildSystemPrompt(cwd: string, isPlanMode: boolean): string {
  const base = `You are Staged AI — a powerful agentic coding assistant running on the user's local machine via the Staged desktop app.

Tools available: Read, Write, Edit, Bash, Glob, Grep, LS.

Guidelines:
- When asked to do something, DO it — don't just explain.
- Always read a file before editing it. Use Edit for targeted changes, Write only for new files or full rewrites.
- Use Glob and Grep for searching. Do NOT use Bash for grep/find/cat operations.
- Write clean, minimal code that follows existing patterns in the codebase.
- Be direct and concise. Lead with the action, not the reasoning.
- Never claim a file was changed or a command was run unless it actually happened through a tool call.

Working directory: ${cwd}`

  if (isPlanMode) {
    return (
      base +
      "\n\nPLAN MODE: Only create plans. Do NOT use Write, Edit, or Bash. Only read files and explain what changes would be made."
    )
  }
  return base
}

/**
 * Run an agent job and yield events.
 * The caller is responsible for cancellation via the AbortSignal.
 */
export async function* runAgent(
  job: AgentJob,
  signal?: AbortSignal
): AsyncGenerator<AgentEvent> {
  const { prompt, modelId, cwd, permissionMode, providerApiKeys, history } =
    job

  try {
    const model = getModel(modelId, providerApiKeys)
    const tools = buildTools(permissionMode, cwd)
    const system = buildSystemPrompt(cwd, permissionMode === "plan")

    const messages: ModelMessage[] = [
      ...history,
      { role: "user", content: prompt } as ModelMessage,
    ]

    let accumulatedText = ""

    const result = streamText({
      model,
      system,
      messages,
      tools,
      stopWhen: stepCountIs(20),
      temperature: 0,
      abortSignal: signal,
    })

    for await (const part of result.fullStream) {
      if (signal?.aborted) break

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = part as Record<string, any>

      switch (p.type) {
        case "text-delta":
          accumulatedText += (p.textDelta as string) ?? ""
          yield { type: "text", text: accumulatedText }
          break

        case "tool-call":
          yield {
            type: "tool-call",
            id: p.toolCallId as string,
            name: p.toolName as string,
            input: p.input,
          }
          break

        case "tool-result":
          yield {
            type: "tool-result",
            id: p.toolCallId as string,
            name: p.toolName as string,
            output:
              typeof p.output === "string" ? p.output : JSON.stringify(p.output),
          }
          break

        case "start-step":
          accumulatedText = ""
          break

        case "error":
          yield {
            type: "error",
            message:
              p.error instanceof Error ? p.error.message : String(p.error),
          }
          return
      }
    }

    const steps = await result.steps
    const finalText =
      steps
        .map((s) => (s as Record<string, unknown>).text as string)
        .filter(Boolean)
        .join("\n") || accumulatedText

    // Build updated history for the caller to persist
    const newMessages: ModelMessage[] = []
    for (const step of steps) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = step as any
      const assistantContent: unknown[] = []
      if (s.text) assistantContent.push({ type: "text", text: s.text })
      for (const tc of s.toolCalls ?? []) {
        assistantContent.push({
          type: "tool-call",
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          input: tc.input,
        })
      }
      if (assistantContent.length > 0) {
        newMessages.push({
          role: "assistant",
          content: assistantContent,
        } as ModelMessage)
      }
      const toolResults = s.toolResults ?? []
      if (toolResults.length > 0) {
        newMessages.push({
          role: "tool",
          content: toolResults.map((tr: Record<string, unknown>) => ({
            type: "tool-result",
            toolCallId: tr.toolCallId,
            toolName: tr.toolName,
            output: tr.output,
          })),
        } as ModelMessage)
      }
    }

    job.history.push(
      { role: "user", content: prompt } as ModelMessage,
      ...newMessages
    )

    yield { type: "done", finalText }
  } catch (err) {
    if (signal?.aborted) {
      yield { type: "done", finalText: "" }
    } else {
      yield {
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      }
    }
  }
}
