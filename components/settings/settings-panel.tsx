"use client"

import { useMemo, useState } from "react"
import { skipToken } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { useCurrentUser } from "@/lib/user-context"

type SettingsTab = "members" | "workspace"

const TAB_LABELS: Array<{ key: SettingsTab; label: string }> = [
  { key: "members", label: "Members" },
  { key: "workspace", label: "Workspace" },
]

function titleFromEmail(email: string) {
  const local = email.split("@")[0] || "member"
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ")
}

export function SettingsPanel() {
  const router = useRouter()
  const { currentUser } = useCurrentUser()
  const { data: workspace } = trpc.workspace.getDefault.useQuery(undefined)
  const workspaceId = workspace?.id
  const workspaceName = workspace?.name
  const workspaceCreatedAt = workspace?.createdAt
  const currentUserId = currentUser?.id

  const [tab, setTab] = useState<SettingsTab>("members")
  const [workspaceTitleDraft, setWorkspaceTitleDraft] = useState<string | null>(
    null
  )

  const [linkRole, setLinkRole] = useState<"member" | "admin">("member")
  const [copiedInviteLink, setCopiedInviteLink] = useState(false)

  const utils = trpc.useUtils()
  const membersQuery = trpc.workspace.getMembers.useQuery(
    workspaceId ? { workspaceId } : skipToken,
    { enabled: tab === "members" && !!workspaceId }
  )
  const inviteLinkQuery = trpc.workspace.getInviteLink.useQuery(
    workspaceId ? { workspaceId } : skipToken,
    { enabled: tab === "members" && !!workspaceId }
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
      router.replace("/workspace")
    },
  })

  const workspaceTitle = workspaceTitleDraft ?? workspaceName ?? ""

  const sortedMembers = useMemo(() => {
    return [...(membersQuery.data || [])].sort((a, b) =>
      a.joinedAt < b.joinedAt ? 1 : -1
    )
  }, [membersQuery.data])

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
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Breadcrumb header */}
      <div className="flex h-12 items-center justify-between border-b border-border/60 px-6">
        <div className="flex items-center gap-1.5 text-[13px]">
          <span className="text-muted-foreground">Workspace</span>
          <span className="text-muted-foreground/60">/</span>
          <span className="font-medium text-foreground">
            {workspaceName || "Settings"}
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left rail — section nav */}
        <div className="flex w-52 flex-shrink-0 flex-col border-r border-border/60">
          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            <section>
              <h3 className="mb-2 px-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/80 uppercase">
                Settings
              </h3>
              <div className="flex flex-col gap-0.5">
                {TAB_LABELS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors",
                      tab === t.key
                        ? "bg-muted/70 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl space-y-6 px-8 py-6">
            {tab === "members" && (
              <div className="space-y-5">
                <section>
                  <h3 className="mb-2 px-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/80 uppercase">
                    Invite Link
                  </h3>
                  <div className="rounded-xl border border-border/60 bg-card p-3.5">
                    {activeLink?.url ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          <Input
                            readOnly
                            value={activeLink.url}
                            className="h-8 text-[12px]"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-md text-[12px]"
                            onClick={async () => {
                              await navigator.clipboard.writeText(
                                activeLink.url
                              )
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
                            size="sm"
                            className="h-8 rounded-md border-destructive/50 text-[12px] text-destructive hover:bg-destructive/10"
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
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Invitees join as{" "}
                          <span className="font-medium text-foreground/80 capitalize">
                            {activeLink.role}
                          </span>
                        </p>
                      </>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1.5">
                          <select
                            className="h-8 rounded-md border border-border/60 bg-background px-2.5 text-[12px]"
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
                            size="sm"
                            className="h-8 rounded-md text-[12px]"
                            disabled={
                              createInviteLink.isPending || !workspaceId
                            }
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
                          <p className="text-[11px] text-destructive">
                            {createInviteLink.error.message ||
                              "Failed to create link."}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </section>

                <section>
                  <h3 className="mb-2 px-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/80 uppercase">
                    Members
                  </h3>

                  {membersQuery.isLoading && (
                    <p className="px-1 text-[12px] text-muted-foreground">
                      Loading members...
                    </p>
                  )}

                  {!membersQuery.isLoading && sortedMembers.length === 0 && (
                    <p className="px-1 text-[12px] text-muted-foreground">
                      No members yet
                    </p>
                  )}

                  <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
                    {sortedMembers.map((member) => {
                      const you = member.userId === currentUserId
                      const name = member.name || titleFromEmail(member.email)
                      return (
                        <div
                          key={member.userId}
                          className="flex items-center gap-3 px-3.5 py-2.5"
                        >
                          <Avatar className="h-8 w-8 ring-1 ring-border/60">
                            <AvatarImage src={member.avatarUrl ?? undefined} />
                            <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">
                              {name[0] || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium">
                              {name}
                              {you ? (
                                <span className="ml-1 text-muted-foreground">
                                  (you)
                                </span>
                              ) : null}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {member.email}
                            </p>
                          </div>
                          <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
                            {member.role}
                          </span>
                          {!you && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 rounded-md px-2 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive"
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
                </section>
              </div>
            )}

            {tab === "workspace" && (
              <div className="space-y-5">
                <section>
                  <h3 className="mb-2 px-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/80 uppercase">
                    Workspace
                  </h3>
                  <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4">
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-muted-foreground">
                        Title
                      </p>
                      <div className="flex gap-1.5">
                        <Input
                          value={workspaceTitle}
                          placeholder="Workspace title"
                          className="h-8 text-[12px]"
                          onChange={(event) =>
                            setWorkspaceTitleDraft(event.target.value)
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-md text-[12px]"
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
                    <p className="text-[11px] text-muted-foreground">
                      Created{" "}
                      {workspaceCreatedAt
                        ? new Date(workspaceCreatedAt).toLocaleDateString(
                            "en-GB",
                            {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            }
                          )
                        : "-"}
                    </p>
                  </div>
                </section>

                <section>
                  <h3 className="mb-2 px-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/80 uppercase">
                    Danger Zone
                  </h3>
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                    <p className="text-[12px] text-muted-foreground">
                      You will lose access to all channels, messages, and files
                      in this workspace.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 h-8 rounded-md border-destructive/50 text-[12px] text-destructive hover:bg-destructive/10"
                      disabled={
                        !workspaceId ||
                        !currentUserId ||
                        leaveWorkspace.isPending
                      }
                      onClick={() => {
                        if (!workspaceId || !currentUserId) return
                        leaveWorkspace.mutate({
                          workspaceId,
                        })
                      }}
                    >
                      {leaveWorkspace.isPending
                        ? "Leaving..."
                        : "Leave workspace"}
                    </Button>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
