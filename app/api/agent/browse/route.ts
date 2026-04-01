import { browseDirectory } from "@/server/agent/project"

export async function POST(req: Request) {
  try {
    const { path } = await req.json()
    const result = await browseDirectory(path)
    return Response.json(result)
  } catch (error) {
    return Response.json({ error: (error as Error).message })
  }
}
