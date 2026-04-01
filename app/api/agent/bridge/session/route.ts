import { createBridgeSession } from "@/server/agent/bridge"

export async function POST(req: Request) {
  const { origin } = new URL(req.url)
  const wsOrigin = origin.startsWith("https://")
    ? origin.replace("https://", "wss://")
    : origin.replace("http://", "ws://")
  const session = createBridgeSession()
  void fetch(`${origin}/api/agent/bridge/ws`, {
    method: "GET",
    cache: "no-store",
  }).catch(() => null)

  return Response.json({
    ok: true,
    transport: "websocket",
    fallbackTransport: "sse",
    session,
    endpoints: {
      ws: `${wsOrigin}/api/agent/bridge/ws`,
      sse: `${origin}/api/agent/bridge/stream`,
      events: `${origin}/api/agent/bridge/events`,
    },
  })
}
