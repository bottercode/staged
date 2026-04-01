import fs from "fs/promises"
import path from "path"
import os from "os"

export async function POST(req: Request) {
  try {
    const { path: dirPath } = await req.json()

    const resolved = dirPath ? path.resolve(dirPath) : os.homedir()

    const stat = await fs.stat(resolved).catch(() => null)
    if (!stat || !stat.isDirectory()) {
      return Response.json({ error: "Not a valid directory" })
    }

    const entries = await fs.readdir(resolved, { withFileTypes: true })
    const folders = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))

    // Detect if this is a project folder
    const entryNames = new Set(entries.map((e) => e.name))
    let projectType: string | null = null
    if (entryNames.has("package.json")) projectType = "node"
    else if (entryNames.has("go.mod")) projectType = "go"
    else if (entryNames.has("Cargo.toml")) projectType = "rust"
    else if (entryNames.has("requirements.txt") || entryNames.has("pyproject.toml"))
      projectType = "python"
    else if (entryNames.has("pom.xml") || entryNames.has("build.gradle"))
      projectType = "java"

    const isGit = entryNames.has(".git")
    const fileCount = entries.filter((e) => !e.name.startsWith(".")).length

    return Response.json({
      path: resolved,
      name: path.basename(resolved),
      parent: path.dirname(resolved),
      folders,
      projectType,
      isGit,
      fileCount,
    })
  } catch (e: any) {
    return Response.json({ error: e.message })
  }
}
