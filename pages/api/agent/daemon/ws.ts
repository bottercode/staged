import type { NextApiRequest, NextApiResponse } from "next"
import { ensureDaemonWebSocketServer } from "@/server/agent/daemon-websocket"

type SocketWithServer = {
  server?: Parameters<typeof ensureDaemonWebSocketServer>[0]
}

export const config = {
  api: {
    bodyParser: false,
  },
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const server = (res.socket as unknown as SocketWithServer | undefined)?.server

  if (server) {
    ensureDaemonWebSocketServer(server)
  }

  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method not allowed" })
    return
  }

  res.status(200).json({
    ok: true,
    transport: "websocket",
    endpoint: "/api/agent/daemon/ws",
  })
}
