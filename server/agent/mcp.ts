import fs from "fs/promises"
import path from "path"

const MCP_PATH = path.join(process.cwd(), ".staged-agent", "mcp-servers.json")

export type McpServerConfig = {
  id: string
  name: string
  url: string
  enabled: boolean
}

async function readConfigs(): Promise<McpServerConfig[]> {
  try {
    const raw = await fs.readFile(MCP_PATH, "utf-8")
    return JSON.parse(raw) as McpServerConfig[]
  } catch {
    return []
  }
}

async function writeConfigs(configs: McpServerConfig[]) {
  await fs.mkdir(path.dirname(MCP_PATH), { recursive: true })
  await fs.writeFile(MCP_PATH, JSON.stringify(configs, null, 2), "utf-8")
}

export async function listMcpServers() {
  return readConfigs()
}

export async function upsertMcpServer(config: McpServerConfig) {
  const configs = await readConfigs()
  const idx = configs.findIndex((c) => c.id === config.id)
  if (idx >= 0) configs[idx] = config
  else configs.push(config)
  await writeConfigs(configs)
}

