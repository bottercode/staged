"use client"

import { useEffect, useMemo, useState } from "react"
import { skipToken } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { trpc } from "@/lib/trpc/client"
import {
  DEFAULT_AGENT_SETTINGS,
  readAgentSettings,
  writeAgentSettings,
} from "@/lib/agent-settings"

type SettingsTab = "members" | "apps" | "workspace"

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

const TAB_LABELS: Array<{ key: SettingsTab; label: string }> = [
  { key: "members", label: "Members" },
  { key: "apps", label: "Apps" },
  { key: "workspace", label: "Workspace Settings" },
]

function titleFromEmail(email: string) {
  const local = email.split("@")[0] || "member"
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ")
}

export function AgentSettingsDialog({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
  workspaceCreatedAt,
  currentUserId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId?: string
  workspaceName?: string
  workspaceCreatedAt?: string | Date
  currentUserId?: string
}) {
  const router = useRouter()
  const [tab, setTab] = useState<SettingsTab>("members")
  const [workspaceTitleDraft, setWorkspaceTitleDraft] = useState<string | null>(
    null
  )

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

  const [linkRole, setLinkRole] = useState<"member" | "admin">("member")
  const [copiedInviteLink, setCopiedInviteLink] = useState(false)

  const utils = trpc.useUtils()
  const membersQuery = trpc.workspace.getMembers.useQuery(
    workspaceId ? { workspaceId } : skipToken,
    { enabled: open && tab === "members" }
  )
  const inviteLinkQuery = trpc.workspace.getInviteLink.useQuery(
    workspaceId ? { workspaceId } : skipToken,
    { enabled: open && tab === "members" }
  )

  const removeMember = trpc.workspace.removeMember.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.workspace.getMembers.invalidate(),
        utils.dm.list.invalidate(),
      ])
    },
  })
  const createInviteLink = trpc.workspace.createInviteLink.useMutation({
    onSuccess: async (data) => {
      if (workspaceId && data.id) {
        utils.workspace.getInviteLink.setData(
          { workspaceId },
          {
            id: data.id,
            url: data.url,
            createdAt: data.createdAt,
            role: linkRole,
          }
        )
      }
      await utils.workspace.getInviteLink.invalidate()
    },
  })
  const revokeInviteLink = trpc.workspace.revokeInviteLink.useMutation({
    onSuccess: async () => {
      createInviteLink.reset()
      if (workspaceId) {
        utils.workspace.getInviteLink.setData({ workspaceId }, null)
      }
      await utils.workspace.getInviteLink.invalidate()
    },
  })
  const updateWorkspaceTitle = trpc.workspace.updateTitle.useMutation({
    onSuccess: async () => {
      await utils.workspace.getDefault.invalidate()
    },
  })
  const leaveWorkspace = trpc.workspace.leave.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.workspace.getDefault.invalidate(),
        utils.channel.list.invalidate(),
        utils.dm.list.invalidate(),
      ])
      onOpenChange(false)
      router.replace("/workspace")
    },
  })

  useEffect(() => {
    if (!open) return
    const load = async () => {
      try {
        const res = await fetch("/api/agent/mcp")
        const data = (await res.json()) as {
          servers?: Array<{
            id: string
            name: string
            url: string
            enabled: boolean
          }>
        }
        setMcpServers(data.servers || [])
      } catch {
        setMcpServers([])
      }
    }
    void load()
  }, [open])

  const workspaceTitle = workspaceTitleDraft ?? workspaceName ?? ""

  const handleSave = () => {
    writeAgentSettings({
      providerApiKeys: {
        anthropicApiKey: values.anthropicApiKey.trim() || undefined,
        openaiApiKey: values.openaiApiKey.trim() || undefined,
        googleApiKey: values.googleApiKey.trim() || undefined,
        mistralApiKey: values.mistralApiKey.trim() || undefined,
        xaiApiKey: values.xaiApiKey.trim() || undefined,
      },
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

  const sortedMembers = useMemo(() => {
    return [...(membersQuery.data || [])].sort((a, b) =>
      a.joinedAt < b.joinedAt ? 1 : -1
    )
  }, [membersQuery.data])

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setWorkspaceTitleDraft(null)
          setTab("members")
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="w-[min(96vw,1200px)] max-w-[1200px]">
        <DialogHeader>
          <DialogTitle>{workspaceName || "Workspace"}</DialogTitle>
          <DialogDescription>
            Manage members, app integrations, and workspace settings.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 border-b">
          {TAB_LABELS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-1 py-2 text-sm ${
                tab === t.key
                  ? "border-foreground font-medium text-foreground"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "members" &&
          (() => {
            // Use query data if available; fall back to mutation return value so the
            // link appears immediately after creation without waiting for a refetch.
            const activeLink =
              inviteLinkQuery.data ??
              (createInviteLink.isSuccess && createInviteLink.data?.url
                ? {
                    id: createInviteLink.data.id ?? "",
                    url: createInviteLink.data.url,
                    role: linkRole,
                    createdAt: createInviteLink.data.createdAt,
                  }
                : null)

            return (
              <div className="space-y-5">
                <div className="rounded-xl border bg-muted/10 p-4">
                  <p className="mb-3 text-sm font-medium text-muted-foreground">
                    Invite via workspace link
                  </p>
                  {activeLink?.url ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Input
                          readOnly
                          value={activeLink.url}
                          className="h-9"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9"
                          onClick={async () => {
                            await navigator.clipboard.writeText(activeLink.url)
                            setCopiedInviteLink(true)
                            window.setTimeout(
                              () => setCopiedInviteLink(false),
                              1200
                            )
                          }}
                        >
                          {copiedInviteLink ? "Copied" : "Copy"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 border-destructive text-destructive hover:bg-destructive/10"
                          disabled={
                            revokeInviteLink.isPending ||
                            !workspaceId ||
                            !activeLink.id
                          }
                          onClick={() => {
                            if (!workspaceId || !activeLink.id) return
                            revokeInviteLink.mutate({
                              workspaceId,
                              inviteLinkId: activeLink.id,
                            })
                          }}
                        >
                          Revoke
                        </Button>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Invitees join as{" "}
                        <span className="font-medium capitalize">
                          {activeLink.role}
                        </span>
                      </p>
                    </>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <select
                          className="h-9 rounded-md border bg-background px-3 text-sm"
                          value={linkRole}
                          onChange={(event) =>
                            setLinkRole(
                              event.target.value as "member" | "admin"
                            )
                          }
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9"
                          disabled={createInviteLink.isPending || !workspaceId}
                          onClick={() => {
                            if (!workspaceId) return
                            createInviteLink.mutate({
                              workspaceId,
                              role: linkRole,
                            })
                          }}
                        >
                          {createInviteLink.isPending
                            ? "Creating link..."
                            : "Create invite link"}
                        </Button>
                      </div>
                      {createInviteLink.isError && (
                        <p className="text-xs text-destructive">
                          {createInviteLink.error.message ||
                            "Failed to create link."}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <p className="text-xs tracking-wider text-muted-foreground uppercase">
                    Current Members
                  </p>

                  {membersQuery.isLoading && (
                    <p className="text-sm text-muted-foreground">
                      Loading members...
                    </p>
                  )}

                  {!membersQuery.isLoading && sortedMembers.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No members yet
                    </p>
                  )}

                  <div className="space-y-3">
                    {sortedMembers.map((member) => {
                      const you = member.userId === currentUserId
                      const name = member.name || titleFromEmail(member.email)
                      return (
                        <div
                          key={member.userId}
                          className="flex items-center gap-3"
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={member.avatarUrl ?? undefined} />
                            <AvatarFallback>{name[0] || "U"}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {name}
                              {you ? (
                                <span className="ml-1 text-muted-foreground">
                                  (you)
                                </span>
                              ) : null}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {member.email}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {member.role}
                            </p>
                          </div>
                          {!you && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 border-destructive text-destructive hover:bg-destructive/10"
                              disabled={removeMember.isPending || !workspaceId}
                              onClick={() => {
                                if (!workspaceId) return
                                removeMember.mutate({
                                  workspaceId,
                                  userId: member.userId,
                                })
                              }}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })()}

        {tab === "apps" && (
          <div className="space-y-4">
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">
                Model API Keys
              </p>
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
            </div>

            <div className="space-y-2 rounded border p-2">
              <p className="text-xs font-medium text-muted-foreground">
                MCP Servers
              </p>
              <div className="space-y-1">
                {mcpServers.map((server) => (
                  <div
                    key={server.id}
                    className="flex items-center gap-2 rounded border px-2 py-1"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">
                        {server.name}
                      </p>
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
        )}

        {tab === "workspace" && (
          <div className="space-y-3">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Workspace Title</p>
              <div className="flex gap-2">
                <Input
                  value={workspaceTitle}
                  placeholder="Workspace title"
                  onChange={(event) =>
                    setWorkspaceTitleDraft(event.target.value)
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    !workspaceId ||
                    !workspaceTitle.trim() ||
                    updateWorkspaceTitle.isPending
                  }
                  onClick={() => {
                    if (!workspaceId || !workspaceTitle.trim()) return
                    updateWorkspaceTitle.mutate({
                      workspaceId,
                      name: workspaceTitle.trim(),
                    })
                  }}
                >
                  Save
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Created{" "}
              {workspaceCreatedAt
                ? new Date(workspaceCreatedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "-"}
            </p>

            <div className="border-t pt-3">
              <p className="text-sm text-muted-foreground">
                You will lose access to all channels, messages, and files in
                this workspace.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 border-destructive text-destructive hover:bg-destructive/10"
                disabled={
                  !workspaceId || !currentUserId || leaveWorkspace.isPending
                }
                onClick={() => {
                  if (!workspaceId || !currentUserId) return
                  leaveWorkspace.mutate({
                    workspaceId,
                    userId: currentUserId,
                  })
                }}
              >
                {leaveWorkspace.isPending ? "Leaving..." : "Leave workspace"}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          {tab === "apps" ? (
            <>
              <Button variant="outline" onClick={handleClear}>
                Clear
              </Button>
              <Button onClick={handleSave}>Save</Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
