#!/usr/bin/env node

import { randomUUID } from "crypto"
import { streamText, stepCountIs } from "ai"
import type { ModelMessage } from "ai"
import { loadSession, saveSession } from "./session"
import { buildTools } from "./tools"
import { getModel, type ProviderKeys } from "./models"
import { runConnectMode } from "./connect"

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

type ParsedArgs = {
  sessionId: string
  modelId: string
  permissionMode: "edit" | "plan"
  prompt: string
}

function parseArgs(argv: string[]): ParsedArgs | null {
  let sessionId: string | undefined
  let modelId: string | undefined
  let permissionMode: "edit" | "plan" = "edit"
  let prompt: string | undefined

  let i = 0
  while (i < argv.length) {
    const arg = argv[i]
    switch (arg) {
      case "--session-id":
        sessionId = argv[++i]
        break
      case "--model":
        modelId = argv[++i]
        break
      case "--permission-mode":
        permissionMode = argv[++i] === "plan" ? "plan" : "edit"
        break
      case "--output-format":
        i++ // skip value
        break
      case "-p":
      case "--verbose":
      case "--include-partial-messages":
        break
      default:
        if (!arg.startsWith("-")) prompt = arg
    }
    i++
  }

  if (!prompt || !modelId) return null

  return {
    sessionId: sessionId ?? randomUUID(),
    modelId,
    permissionMode,
    prompt,
  }
}

// ---------------------------------------------------------------------------
// Stream-json output (format expected by agent-runner.ts)
// ---------------------------------------------------------------------------

function emit(event: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(event) + "\n")
}

// ---------------------------------------------------------------------------
// Provider keys from env (set by server when spawning the daemon)
// ---------------------------------------------------------------------------

function getProviderKeys(): ProviderKeys {
  return {
    anthropicApiKey: process.env.STAGED_ANTHROPIC_API_KEY,
    openaiApiKey: process.env.STAGED_OPENAI_API_KEY,
    googleApiKey: process.env.STAGED_GOOGLE_API_KEY,
    mistralApiKey: process.env.STAGED_MISTRAL_API_KEY,
    xaiApiKey: process.env.STAGED_XAI_API_KEY,
  }
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

function buildSystemPrompt(cwd: string, isPlanMode: boolean): string {
  const base = `You are Staged AI — a powerful agentic coding assistant running on the user's local machine.

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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Handle: staged connect --url <wsUrl> --token <token>
  const rawArgs = process.argv.slice(2)
  if (rawArgs[0] === "connect") {
    await runConnectMode(rawArgs.slice(1))
    return
  }

  const args = parseArgs(rawArgs)

  if (!args) {
    process.stderr.write("staged: --model and a prompt are required\n")
    process.exit(1)
  }

  const { sessionId, modelId, permissionMode, prompt } = args
  const cwd = process.cwd()
  const keys = getProviderKeys()

  const session = await loadSession(sessionId)
  session.messages.push({ role: "user", content: prompt } as ModelMessage)

  emit({ type: "system", subtype: "init", session_id: sessionId })

  let finalText = ""
  let isError = false

  try {
    const model = getModel(modelId, keys)
    const tools = buildTools(permissionMode, cwd)
    const system = buildSystemPrompt(cwd, permissionMode === "plan")

    let accumulatedText = ""

    const result = streamText({
      model,
      system,
      messages: session.messages,
      tools,
      stopWhen: stepCountIs(20),
      temperature: 0,
    })

    for await (const part of result.fullStream) {
      // Cast to any — fullStream event shapes vary by tool generics,
      // but the runtime properties are consistent.
      const p = part as Record<string, unknown>

      switch (p.type) {
        case "text-delta":
          accumulatedText += (p.textDelta as string) ?? ""
          emit({
            type: "assistant",
            message: {
              role: "assistant",
              content: [{ type: "text", text: accumulatedText }],
            },
            session_id: sessionId,
          })
          break

        case "tool-call":
          emit({
            type: "assistant",
            message: {
              role: "assistant",
              content: [{
                type: "tool_use",
                id: p.toolCallId,
                name: p.toolName,
                input: p.input,
              }],
            },
            session_id: sessionId,
          })
          break

        case "tool-result":
          emit({
            type: "tool_result",
            message: {
              role: "user",
              content: [{
                type: "tool_result",
                tool_use_id: p.toolCallId,
                content:
                  typeof p.output === "string"
                    ? p.output
                    : JSON.stringify(p.output),
              }],
            },
            session_id: sessionId,
          })
          break

        case "start-step":
          // Reset text accumulator for the next step
          accumulatedText = ""
          break

        case "error":
          isError = true
          finalText =
            p.error instanceof Error
              ? p.error.message
              : String(p.error)
          break
      }
    }

    // Collect final text and persist session from all steps
    const steps = await result.steps
    finalText =
      steps
        .map((s) => s.text)
        .filter(Boolean)
        .join("\n") || finalText

    // Reconstruct ModelMessage[] from all steps for session persistence
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
        newMessages.push({ role: "assistant", content: assistantContent } as ModelMessage)
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
    session.messages.push(...newMessages)
  } catch (err) {
    isError = true
    finalText = err instanceof Error ? err.message : String(err)
    process.stderr.write(finalText + "\n")
  }

  await saveSession(session)

  emit({
    type: "result",
    subtype: isError ? "error" : "success",
    is_error: isError,
    result: finalText,
    session_id: sessionId,
  })
}

main().catch((err) => {
  process.stderr.write(String(err) + "\n")
  process.exit(1)
})
