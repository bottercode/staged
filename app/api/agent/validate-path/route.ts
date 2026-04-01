import { validateProjectPath } from "@/server/agent/project"

export async function POST(req: Request) {
  try {
    const { path } = await req.json()
    const result = await validateProjectPath(path)
    return Response.json(result)
  } catch (error) {
    return Response.json({ valid: false, error: (error as Error).message })
  }
}
