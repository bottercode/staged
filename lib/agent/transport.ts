import { DefaultChatTransport, type UIMessage, type UIMessageChunk } from "ai"

type BridgeTransportOptions = {
  api: string
  conversationId: string
}

/**
 * BridgeTransport attempts a WebSocket connection for streaming,
 * falling back to DefaultChatTransport (SSE) if WS is unavailable.
 */
export class BridgeTransport extends DefaultChatTransport<UIMessage> {
  private conversationId: string
  private wsEndpoint: string | null = null
  private negotiated = false

  constructor({ api, conversationId }: BridgeTransportOptions) {
    super({ api })
    this.conversationId = conversationId
  }

  private async negotiate(): Promise<void> {
    if (this.negotiated) return
    try {
      const res = await fetch(
        `${(this as any).api ?? "/api/agent"}/bridge/negotiate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: this.conversationId }),
        }
      )
      if (res.ok) {
        const data = await res.json()
        if (data.transport === "websocket" && data.endpoints?.ws) {
          this.wsEndpoint = data.endpoints.ws
        }
      }
    } catch {
      // Negotiation failed — will use SSE fallback
    }
    this.negotiated = true
  }

  private streamFromWebSocket(
    url: string,
    abortSignal: AbortSignal | undefined
  ): ReadableStream<UIMessageChunk> {
    return new ReadableStream<UIMessageChunk>({
      start(controller) {
        const wsUrl = url.startsWith("/")
          ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}${url}`
          : url

        const ws = new WebSocket(wsUrl)
        let opened = false

        ws.addEventListener("open", () => {
          opened = true
        })

        ws.addEventListener("message", (event) => {
          try {
            const chunk = JSON.parse(event.data) as UIMessageChunk
            controller.enqueue(chunk)
          } catch {
            // Non-JSON message (heartbeat, etc.) — ignore
          }
        })

        ws.addEventListener("close", () => {
          try {
            controller.close()
          } catch {
            // Already closed
          }
        })

        ws.addEventListener("error", () => {
          if (!opened) {
            // Never connected — signal to caller that WS failed
            controller.error(new Error("WebSocket connection failed"))
          } else {
            try {
              controller.close()
            } catch {
              // Already closed
            }
          }
        })

        abortSignal?.addEventListener("abort", () => {
          ws.close()
        })
      },
    })
  }

  async sendMessages(
    options: Parameters<DefaultChatTransport<UIMessage>["sendMessages"]>[0]
  ): Promise<ReadableStream<UIMessageChunk>> {
    await this.negotiate()

    // Try WebSocket first
    if (this.wsEndpoint) {
      try {
        const stream = this.streamFromWebSocket(
          this.wsEndpoint,
          options.abortSignal
        )
        // Test if the stream works by reading the first chunk
        const reader = stream.getReader()
        const { value, done } = await Promise.race([
          reader.read(),
          new Promise<{ value: undefined; done: true }>((resolve) =>
            setTimeout(() => resolve({ value: undefined, done: true }), 3000)
          ),
        ])

        // If we got a value, create a new stream that starts with it
        if (value && !done) {
          const remaining = new ReadableStream<UIMessageChunk>({
            async start(controller) {
              controller.enqueue(value)
              try {
                while (true) {
                  const { value: nextValue, done: nextDone } =
                    await reader.read()
                  if (nextDone) break
                  if (nextValue) controller.enqueue(nextValue)
                }
                controller.close()
              } catch {
                controller.close()
              }
            },
          })
          return remaining
        }

        // WebSocket didn't produce data in time — release and fall through
        reader.releaseLock()
      } catch {
        // WebSocket failed — fall through to SSE
        console.log("Bridge: WebSocket failed, falling back to SSE")
      }
    }

    // Fallback to default SSE transport
    return super.sendMessages(options)
  }

  async reconnectToStream(
    options: Parameters<DefaultChatTransport<UIMessage>["reconnectToStream"]>[0]
  ): Promise<ReadableStream<UIMessageChunk> | null> {
    // For reconnection, always use the default SSE approach
    return super.reconnectToStream(options)
  }
}
