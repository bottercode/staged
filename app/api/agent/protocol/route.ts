import fs from "fs/promises"
import path from "path"
import { historyEventToProtocol } from "@/server/agent/protocol"

function sanitizeFileName(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_")
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const conversationId = searchParams.get("conversationId")?.trim()

  if (!conversationId) {
    return Response.json(
      { ok: false, error: "conversationId is required" },
      { status: 400 }
    )
  }

  try {
    const historyPath = path.join(
      process.cwd(),
      ".staged-agent",
      "history",
      `${sanitizeFileName(conversationId)}.jsonl`
    )
    const raw = await fs.readFile(historyPath, "utf-8")
    const events = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { ts: string; type: string; payload: Record<string, unknown> })
      .map((event) => historyEventToProtocol(event))
      .filter(Boolean)

    return Response.json({ ok: true, events })
  } catch {
    return Response.json({ ok: true, events: [] })
  }
}

