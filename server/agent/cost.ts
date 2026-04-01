import type { UIMessage } from "ai"

export type UsageEstimate = {
  inputChars: number
  outputChars: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCostUsd: number
}

const PROVIDER_TOKEN_COST_USD_PER_1K: Record<string, { in: number; out: number }> = {
  anthropic: { in: 0.003, out: 0.015 },
  openai: { in: 0.0025, out: 0.01 },
  google: { in: 0.0015, out: 0.005 },
  mistral: { in: 0.002, out: 0.006 },
  xai: { in: 0.003, out: 0.012 },
  unknown: { in: 0.002, out: 0.008 },
}

function estimateTokensFromChars(chars: number) {
  return Math.ceil(chars / 4)
}

export function estimateInputUsage(messages: UIMessage[] | unknown[]) {
  const inputChars = messages.reduce<number>((sum, message) => {
    const parts = Array.isArray((message as { parts?: unknown }).parts)
      ? (((message as { parts?: unknown[] }).parts || []) as Array<{
          type?: string
          text?: string
        }>)
      : []
    const text = parts
      .filter((p) => p.type === "text")
      .map((p) => (typeof p.text === "string" ? p.text : ""))
      .join("")
    return sum + text.length
  }, 0)

  if (!Number.isFinite(inputChars)) {
    return { inputChars: 0, inputTokens: 0 }
  }

  return {
    inputChars,
    inputTokens: estimateTokensFromChars(inputChars),
  }
}

export function estimateRunCost(params: {
  provider: string
  inputTokens: number
  outputTokens: number
}): UsageEstimate {
  const pricing =
    PROVIDER_TOKEN_COST_USD_PER_1K[params.provider] ||
    PROVIDER_TOKEN_COST_USD_PER_1K.unknown
  const inCost = (params.inputTokens / 1000) * pricing.in
  const outCost = (params.outputTokens / 1000) * pricing.out

  return {
    inputChars: params.inputTokens * 4,
    outputChars: params.outputTokens * 4,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    totalTokens: params.inputTokens + params.outputTokens,
    estimatedCostUsd: Number((inCost + outCost).toFixed(6)),
  }
}
