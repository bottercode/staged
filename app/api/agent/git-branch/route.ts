import { execFile } from "child_process"
import { promisify } from "util"
import fs from "fs/promises"

const execFileAsync = promisify(execFile)

export async function POST(req: Request) {
  try {
    const { cwd } = await req.json()

    if (!cwd || typeof cwd !== "string") {
      return Response.json({ branch: null, isGit: false })
    }

    const stat = await fs.stat(cwd).catch(() => null)
    if (!stat || !stat.isDirectory()) {
      return Response.json({ branch: null, isGit: false })
    }

    const { stdout } = await execFileAsync(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      { cwd, timeout: 10_000 }
    )

    const branch = stdout.trim()
    return Response.json({
      branch: branch || null,
      isGit: Boolean(branch),
    })
  } catch {
    return Response.json({ branch: null, isGit: false })
  }
}

