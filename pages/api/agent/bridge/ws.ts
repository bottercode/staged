import type { NextApiRequest, NextApiResponse } from "next"
import { ensureBridgeWebSocketServer } from "@/server/agent/bridge-websocket"

type SocketWithServer = {
  server?: Parameters<typeof ensureBridgeWebSocketServer>[0]
}

export const config = {
  api: {
    bodyParser: false,
  },
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const server = (res.socket as unknown as SocketWithServer | undefined)?.server

  if (server) {
    ensureBridgeWebSocketServer(server)
  }

  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method not allowed" })
    return
  }

  res.status(200).json({
    ok: true,
    transport: "websocket",
    endpoint: "/api/agent/bridge/ws",
  })
}
