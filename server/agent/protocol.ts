export type AgentProtocolMessage =
  | {
      type: "system"
      subtype: "status" | "compact_boundary" | "api_retry"
      timestamp: string
      payload: Record<string, unknown>
    }
  | {
      type: "tool_progress"
      timestamp: string
      payload: Record<string, unknown>
    }
  | {
      type: "result"
      subtype: "success" | "error"
      timestamp: string
      payload: Record<string, unknown>
    }

type HistoryEvent = {
  ts: string
  type: string
  payload: Record<string, unknown>
}

export function historyEventToProtocol(
  event: HistoryEvent
): AgentProtocolMessage | null {
  if (event.type === "status") {
    const status = String(event.payload.status ?? "")
    const subtype = status.startsWith("api_retry.") ? "api_retry" : "status"
    return {
      type: "system",
      subtype,
      timestamp: event.ts,
      payload: event.payload,
    }
  }

  if (event.type === "tool_input" || event.type === "tool_output") {
    return {
      type: "tool_progress",
      timestamp: event.ts,
      payload: event.payload,
    }
  }

  if (event.type === "compaction") {
    return {
      type: "system",
      subtype: "compact_boundary",
      timestamp: event.ts,
      payload: event.payload,
    }
  }

  if (event.type === "turn_finish" || event.type === "turn_error") {
    return {
      type: "result",
      subtype: event.type === "turn_finish" ? "success" : "error",
      timestamp: event.ts,
      payload: event.payload,
    }
  }

  return null
}

