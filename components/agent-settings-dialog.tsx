"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  DEFAULT_AGENT_SETTINGS,
  readAgentSettings,
  writeAgentSettings,
} from "@/lib/agent-settings"

type FieldKey =
  | "anthropicApiKey"
  | "openaiApiKey"
  | "googleApiKey"
  | "mistralApiKey"
  | "xaiApiKey"

const FIELDS: Array<{ key: FieldKey; label: string; placeholder: string }> = [
  { key: "anthropicApiKey", label: "Anthropic", placeholder: "sk-ant-..." },
  { key: "openaiApiKey", label: "OpenAI", placeholder: "sk-..." },
  { key: "googleApiKey", label: "Google", placeholder: "AIza..." },
  { key: "mistralApiKey", label: "Mistral", placeholder: "..." },
  { key: "xaiApiKey", label: "xAI", placeholder: "xai-..." },
]

export function AgentSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [values, setValues] = useState<Record<FieldKey, string>>({
    anthropicApiKey: readAgentSettings().providerApiKeys.anthropicApiKey || "",
    openaiApiKey: readAgentSettings().providerApiKeys.openaiApiKey || "",
    googleApiKey: readAgentSettings().providerApiKeys.googleApiKey || "",
    mistralApiKey: readAgentSettings().providerApiKeys.mistralApiKey || "",
    xaiApiKey: readAgentSettings().providerApiKeys.xaiApiKey || "",
  })
  const [mcpServers, setMcpServers] = useState<
    Array<{ id: string; name: string; url: string; enabled: boolean }>
  >([])
  const [newMcpName, setNewMcpName] = useState("")
  const [newMcpUrl, setNewMcpUrl] = useState("")

  useEffect(() => {
    if (!open) return
    const load = async () => {
      try {
        const res = await fetch("/api/agent/mcp")
        const data = (await res.json()) as {
          servers?: Array<{ id: string; name: string; url: string; enabled: boolean }>
        }
        setMcpServers(data.servers || [])
      } catch {
        setMcpServers([])
      }
    }
    void load()
  }, [open])

  const handleSave = () => {
    writeAgentSettings({
      providerApiKeys: {
        anthropicApiKey: values.anthropicApiKey.trim() || undefined,
        openaiApiKey: values.openaiApiKey.trim() || undefined,
        googleApiKey: values.googleApiKey.trim() || undefined,
        mistralApiKey: values.mistralApiKey.trim() || undefined,
        xaiApiKey: values.xaiApiKey.trim() || undefined,
      },
      permissionMode: readAgentSettings().permissionMode,
    })
    onOpenChange(false)
  }

  const handleClear = () => {
    writeAgentSettings(DEFAULT_AGENT_SETTINGS)
    setValues({
      anthropicApiKey: "",
      openaiApiKey: "",
      googleApiKey: "",
      mistralApiKey: "",
      xaiApiKey: "",
    })
  }

  const upsertMcp = async (server: {
    id: string
    name: string
    url: string
    enabled: boolean
  }) => {
    await fetch("/api/agent/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(server),
    })
  }

  const addMcpServer = async () => {
    const name = newMcpName.trim()
    const url = newMcpUrl.trim()
    if (!name || !url) return
    const next = {
      id: `mcp-${Date.now()}`,
      name,
      url,
      enabled: true,
    }
    setMcpServers((prev) => prev.concat(next))
    setNewMcpName("")
    setNewMcpUrl("")
    try {
      await upsertMcp(next)
    } catch {
      // ignore
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agent BYOK Settings</DialogTitle>
          <DialogDescription>
            Add provider API keys to run models with your own credentials. Keys
            are stored locally in your browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {FIELDS.map((field) => (
            <div key={field.key} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {field.label}
              </p>
              <Input
                type="password"
                value={values[field.key]}
                placeholder={field.placeholder}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    [field.key]: event.target.value,
                  }))
                }
              />
            </div>
          ))}

          <div className="space-y-2 rounded border p-2">
            <p className="text-xs font-medium text-muted-foreground">MCP Servers</p>
            <div className="space-y-1">
              {mcpServers.map((server) => (
                <div
                  key={server.id}
                  className="flex items-center gap-2 rounded border px-2 py-1"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{server.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {server.url}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const updated = { ...server, enabled: !server.enabled }
                      setMcpServers((prev) =>
                        prev.map((s) => (s.id === server.id ? updated : s))
                      )
                      try {
                        await upsertMcp(updated)
                      } catch {
                        // ignore
                      }
                    }}
                    className="rounded border px-2 py-1 text-[10px]"
                  >
                    {server.enabled ? "Enabled" : "Disabled"}
                  </button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={newMcpName}
                placeholder="Server name"
                onChange={(e) => setNewMcpName(e.target.value)}
              />
              <Input
                value={newMcpUrl}
                placeholder="https://mcp.example.com"
                onChange={(e) => setNewMcpUrl(e.target.value)}
              />
            </div>
            <Button type="button" variant="outline" onClick={addMcpServer}>
              Add MCP server
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClear}>
            Clear
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
