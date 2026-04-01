import { listMcpServers, upsertMcpServer } from "@/server/agent/mcp"

export async function GET() {
  const servers = await listMcpServers()
  return Response.json({ ok: true, servers })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const id = typeof body?.id === "string" ? body.id.trim() : ""
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const url = typeof body?.url === "string" ? body.url.trim() : ""
  const enabled = Boolean(body?.enabled)

  if (!id || !name || !url) {
    return Response.json(
      { ok: false, error: "id, name and url are required" },
      { status: 400 }
    )
  }

  await upsertMcpServer({ id, name, url, enabled })
  return Response.json({ ok: true })
}

