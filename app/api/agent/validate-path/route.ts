import fs from "fs/promises"
import path from "path"

export async function POST(req: Request) {
  try {
    const { path: dirPath } = await req.json()

    if (!dirPath || typeof dirPath !== "string") {
      return Response.json({ valid: false, error: "Path is required" })
    }

    const resolved = path.resolve(dirPath)

    // Check exists and is directory
    const stat = await fs.stat(resolved).catch(() => null)
    if (!stat || !stat.isDirectory()) {
      return Response.json({ valid: false, error: "Not a valid directory" })
    }

    // Read top-level entries
    const entries = await fs.readdir(resolved, { withFileTypes: true })
    const files = entries
      .filter((e) => !e.name.startsWith("."))
      .map((e) => (e.isDirectory() ? e.name + "/" : e.name))
    const fileCount = files.length

    // Detect project type
    const entryNames = new Set(entries.map((e) => e.name))
    let projectType = "unknown"
    if (entryNames.has("package.json")) projectType = "node"
    else if (entryNames.has("go.mod")) projectType = "go"
    else if (entryNames.has("Cargo.toml")) projectType = "rust"
    else if (entryNames.has("requirements.txt") || entryNames.has("pyproject.toml"))
      projectType = "python"
    else if (entryNames.has("pom.xml") || entryNames.has("build.gradle"))
      projectType = "java"

    // Check for git
    const isGit = entryNames.has(".git")

    return Response.json({
      valid: true,
      name: path.basename(resolved),
      path: resolved,
      fileCount,
      projectType,
      isGit,
      files: files.slice(0, 50),
    })
  } catch (e: any) {
    return Response.json({ valid: false, error: e.message })
  }
}
