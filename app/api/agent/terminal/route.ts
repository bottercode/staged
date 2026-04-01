import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export async function POST(req: Request) {
  try {
    const { command, cwd } = await req.json()

    if (!command || typeof command !== "string") {
      return Response.json({ error: "Command is required" })
    }

    if (!cwd || typeof cwd !== "string") {
      return Response.json({ error: "Working directory is required" })
    }

    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 5,
      shell: "/bin/zsh",
      env: { ...process.env, TERM: "xterm-256color" },
    })

    return Response.json({
      stdout: stdout || "",
      stderr: stderr || "",
      exitCode: 0,
    })
  } catch (e: any) {
    return Response.json({
      stdout: e.stdout || "",
      stderr: e.stderr || e.message || "",
      exitCode: e.code ?? 1,
    })
  }
}
