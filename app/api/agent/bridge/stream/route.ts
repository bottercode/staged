import { authenticateBridgeSession, listBridgeEvents } from "@/server/agent/bridge"

export const runtime = "nodejs"

function encodeSse(event: string, data: unknown, id?: number) {
  const lines = []
  if (id != null) lines.push(`id: ${id}`)
  lines.push(`event: ${event}`)
  lines.push(`data: ${JSON.stringify(data)}`)
  lines.push("")
  return `${lines.join("\n")}\n`
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get("sessionId")?.trim() || ""
  const token = searchParams.get("token")?.trim() || ""
  const cursor = Number(searchParams.get("cursor") || "")
  const afterSeq = Number.isFinite(cursor) ? cursor : 0

  if (!sessionId || !token) {
    return new Response("missing sessionId/token", { status: 400 })
  }
  if (!authenticateBridgeSession(sessionId, token)) {
    return new Response("unauthorized", { status: 401 })
  }

  const stream = new ReadableStream({
    start(controller) {
      let disposed = false
      let currentCursor = afterSeq

      const sendEvents = () => {
        const events = listBridgeEvents(sessionId, { afterSeq: currentCursor }) || []
        for (const event of events) {
          currentCursor = Math.max(currentCursor, event.seq)
          controller.enqueue(
            new TextEncoder().encode(
              encodeSse("message", {
                id: event.id,
                type: event.type,
                payload: event.payload,
                ts: event.ts,
                seq: event.seq,
              }, event.seq)
            )
          )
        }
      }

      sendEvents()
      const poll = setInterval(() => {
        if (disposed) return
        sendEvents()
        controller.enqueue(
          new TextEncoder().encode(
            encodeSse("heartbeat", { ts: Date.now(), cursor: currentCursor }, currentCursor)
          )
        )
      }, 1200)

      const timeout = setTimeout(() => {
        disposed = true
        clearInterval(poll)
        controller.close()
      }, 55_000)

      const onAbort = () => {
        disposed = true
        clearInterval(poll)
        clearTimeout(timeout)
        controller.close()
      }

      req.signal.addEventListener("abort", onAbort)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}

