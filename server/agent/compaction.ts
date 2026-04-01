import type { UIMessage } from "ai"

export type CompactionMode = "micro" | "auto" | "snip" | "reactive"

export type CompactionMetadata = {
  mode: CompactionMode
  droppedMessages: number
  estimatedTokensBefore: number
  estimatedTokensAfter: number
  preservedTailMessages: number
}

export type CompactionResult = {
  messages: UIMessage[]
  compacted: boolean
  metadata?: CompactionMetadata
}

function estimateMessageTokens(message: UIMessage) {
  const parts = Array.isArray(message.parts) ? message.parts : []
  const text = parts
    .filter((p) => p.type === "text")
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("")
  return Math.max(1, Math.ceil(text.length / 4))
}

function estimateTokens(messages: UIMessage[]) {
  return messages.reduce((sum, message) => sum + estimateMessageTokens(message), 0)
}

function createBoundary(metadata: CompactionMetadata): UIMessage {
  return {
    id: `compact-${Date.now()}-${metadata.mode}`,
    role: "assistant",
    parts: [
      {
        type: "text",
        text: `[Context ${metadata.mode}-compacted: dropped ${metadata.droppedMessages} messages, tokens ${metadata.estimatedTokensBefore} -> ${metadata.estimatedTokensAfter}.]`,
      },
    ],
  }
}

function compactByMode(messages: UIMessage[], mode: CompactionMode): CompactionResult {
  const before = estimateTokens(messages)
  const strategy =
    mode === "micro"
      ? { keepHead: 6, keepTail: 40 }
      : mode === "auto"
        ? { keepHead: 4, keepTail: 26 }
        : mode === "snip"
          ? { keepHead: 3, keepTail: 18 }
          : { keepHead: 2, keepTail: 12 }

  const dropped = Math.max(messages.length - (strategy.keepHead + strategy.keepTail), 0)
  if (dropped <= 0) return { messages, compacted: false }

  const candidate = [
    ...messages.slice(0, strategy.keepHead),
    ...messages.slice(-strategy.keepTail),
  ]
  const after = estimateTokens(candidate)

  const metadata: CompactionMetadata = {
    mode,
    droppedMessages: dropped,
    estimatedTokensBefore: before,
    estimatedTokensAfter: after,
    preservedTailMessages: strategy.keepTail,
  }

  return {
    messages: [
      ...messages.slice(0, strategy.keepHead),
      createBoundary(metadata),
      ...messages.slice(-strategy.keepTail),
    ],
    compacted: true,
    metadata,
  }
}

export function compactMessages(
  messages: UIMessage[],
  thresholds?: {
    microTokens?: number
    autoTokens?: number
    snipTokens?: number
    reactiveTokens?: number
  }
): CompactionResult {
  const tokenCount = estimateTokens(messages)
  const micro = thresholds?.microTokens ?? 11_000
  const auto = thresholds?.autoTokens ?? 18_000
  const snip = thresholds?.snipTokens ?? 26_000
  const reactive = thresholds?.reactiveTokens ?? 34_000

  if (tokenCount > reactive) return compactByMode(messages, "reactive")
  if (tokenCount > snip) return compactByMode(messages, "snip")
  if (tokenCount > auto) return compactByMode(messages, "auto")
  if (tokenCount > micro) return compactByMode(messages, "micro")
  return { messages, compacted: false }
}

