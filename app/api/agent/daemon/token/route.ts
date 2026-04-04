import { getAuthenticatedUserId } from "@/server/auth-user"
import { createDaemonToken } from "@/server/agent/daemon-registry"
import { isDaemonConnected } from "@/server/agent/daemon-registry"

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  // Resolve public origin — behind Render's reverse proxy req.url is internal
  const reqUrl = new URL(req.url)
  const forwardedHost = req.headers.get("x-forwarded-host")
  const forwardedProto =
    req.headers.get("x-forwarded-proto") ?? reqUrl.protocol.replace(":", "")
  const publicOrigin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : reqUrl.origin

  // Warm the daemon ws endpoint so the upgrade listener is registered
  void fetch(`${publicOrigin}/api/agent/daemon/ws`, {
    method: "GET",
    cache: "no-store",
  }).catch(() => null)

  const token = createDaemonToken(userId)
  const wsUrl = publicOrigin.startsWith("https://")
    ? publicOrigin.replace("https://", "wss://")
    : publicOrigin.replace("http://", "ws://")

  return Response.json({
    ok: true,
    token,
    connected: isDaemonConnected(userId),
    command: `staged connect --url ${wsUrl} --token ${token}`,
    wsUrl: `${wsUrl}/api/agent/daemon/ws`,
  })
}

export async function GET(req: Request) {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  return Response.json({
    ok: true,
    connected: isDaemonConnected(userId),
  })
}
