import fs from "fs/promises"
import os from "os"
import path from "path"

export type ProjectType = "node" | "go" | "rust" | "python" | "java" | "unknown"

export type ProjectInfo = {
  valid: boolean
  name: string
  path: string
  fileCount: number
  projectType: ProjectType
  isGit: boolean
  files: string[]
  error?: string
}

export function detectProjectType(entries: string[]): ProjectType {
  const entryNames = new Set(entries)

  if (entryNames.has("package.json")) return "node"
  if (entryNames.has("go.mod")) return "go"
  if (entryNames.has("Cargo.toml")) return "rust"
  if (entryNames.has("requirements.txt") || entryNames.has("pyproject.toml")) {
    return "python"
  }
  if (entryNames.has("pom.xml") || entryNames.has("build.gradle")) {
    return "java"
  }

  return "unknown"
}

export async function validateProjectPath(dirPath: string): Promise<ProjectInfo> {
  try {
    if (!dirPath || typeof dirPath !== "string") {
      return { valid: false, error: "Path is required" } as ProjectInfo
    }

    const resolved = path.resolve(dirPath)
    const stat = await fs.stat(resolved).catch(() => null)

    if (!stat || !stat.isDirectory()) {
      return { valid: false, error: "Not a valid directory" } as ProjectInfo
    }

    const entries = await fs.readdir(resolved, { withFileTypes: true })
    const visible = entries.filter((entry) => !entry.name.startsWith("."))
    const files = visible.map((entry) =>
      entry.isDirectory() ? `${entry.name}/` : entry.name
    )

    return {
      valid: true,
      name: path.basename(resolved),
      path: resolved,
      fileCount: files.length,
      projectType: detectProjectType(entries.map((entry) => entry.name)),
      isGit: entries.some((entry) => entry.name === ".git"),
      files: files.slice(0, 50),
    }
  } catch (error) {
    return { valid: false, error: (error as Error).message } as ProjectInfo
  }
}

export async function browseDirectory(dirPath?: string) {
  const resolved = dirPath ? path.resolve(dirPath) : os.homedir()
  const stat = await fs.stat(resolved).catch(() => null)

  if (!stat || !stat.isDirectory()) {
    return { error: "Not a valid directory" }
  }

  const entries = await fs.readdir(resolved, { withFileTypes: true })
  const folders = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))

  const visibleNames = entries
    .filter((entry) => !entry.name.startsWith("."))
    .map((entry) => entry.name)

  return {
    path: resolved,
    name: path.basename(resolved),
    parent: path.dirname(resolved),
    folders,
    projectType: detectProjectType(visibleNames),
    isGit: entries.some((entry) => entry.name === ".git"),
    fileCount: visibleNames.length,
  }
}

export async function buildProjectContext(projectPath: string) {
  const entries = await fs.readdir(projectPath, { withFileTypes: true })
  const topLevelEntries = entries
    .filter((entry) => !entry.name.startsWith(".") && entry.name !== "node_modules")
    .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
    .slice(0, 100)

  return {
    folderName: path.basename(projectPath),
    topLevelEntries,
  }
}
