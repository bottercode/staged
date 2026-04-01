"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import {
  Globe,
  ExternalLink,
  Plus,
  FileCheck,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Send,
  Mail,
  Copy,
  Check,
} from "lucide-react"
import { trpc } from "@/lib/trpc/client"
import { useCurrentUser } from "@/lib/user-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatShortDate(date: Date) {
  return new Date(date).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function PortalManagePage() {
  const { portalId } = useParams<{ portalId: string }>()
  const { currentUser } = useCurrentUser()
  const [newUpdate, setNewUpdate] = useState("")
  const [updateType, setUpdateType] = useState<"update" | "deliverable">(
    "update"
  )
  const [expandedComments, setExpandedComments] = useState<Set<string>>(
    new Set()
  )
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState(false)
  const utils = trpc.useUtils()

  const { data: portal } = trpc.portal.getById.useQuery(
    { id: portalId },
    { refetchInterval: 3000 }
  )

  const addUpdate = trpc.portal.addUpdate.useMutation({
    onSuccess: () => {
      utils.portal.getById.invalidate({ id: portalId })
      setNewUpdate("")
      setUpdateType("update")
    },
  })

  const addComment = trpc.portal.addComment.useMutation({
    onSuccess: (_, variables) => {
      utils.portal.getById.invalidate({ id: portalId })
      setReplyTexts((prev) => ({ ...prev, [variables.updateId]: "" }))
    },
  })

  const toggleComments = (updateId: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev)
      if (next.has(updateId)) next.delete(updateId)
      else next.add(updateId)
      return next
    })
  }

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.origin + `/portal/${portal?.slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!portal) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading portal...</div>
      </div>
    )
  }

  const portalUrl = `/portal/${portal.slug}`
  const deliverableCount = portal.updates.filter(
    (u) => u.type === "deliverable"
  ).length
  const approvedCount = portal.updates.filter(
    (u) => u.status === "approved"
  ).length
  const pendingCount = portal.updates.filter(
    (u) => u.type === "deliverable" && u.status === "none"
  ).length
  const totalComments = portal.updates.reduce(
    (sum, u) => sum + u.comments.length,
    0
  )

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex h-12 items-center gap-2 border-b px-6">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">{portal.name}</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium",
            portal.status === "active"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          )}
        >
          {portal.status}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={copyLink}>
            {copied ? (
              <Check className="mr-1 h-3 w-3" />
            ) : (
              <Copy className="mr-1 h-3 w-3" />
            )}
            {copied ? "Copied" : "Copy link"}
          </Button>
          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" className="h-7 text-xs">
              <ExternalLink className="mr-1 h-3 w-3" />
              Client view
            </Button>
          </a>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — details + compose */}
        <div className="flex w-80 flex-shrink-0 flex-col border-r">
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Client info card */}
            <div>
              <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Client
              </h3>
              <div className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {portal.clientName[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{portal.clientName}</p>
                    {portal.clientEmail && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {portal.clientEmail}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div>
              <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Overview
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border bg-card px-3 py-2">
                  <div className="text-lg font-bold">{portal.updates.length}</div>
                  <div className="text-[11px] text-muted-foreground">Updates</div>
                </div>
                <div className="rounded-lg border bg-card px-3 py-2">
                  <div className="text-lg font-bold">{deliverableCount}</div>
                  <div className="text-[11px] text-muted-foreground">Deliverables</div>
                </div>
                <div className="rounded-lg border bg-card px-3 py-2">
                  <div className="text-lg font-bold text-emerald-600">{approvedCount}</div>
                  <div className="text-[11px] text-muted-foreground">Approved</div>
                </div>
                <div className="rounded-lg border bg-card px-3 py-2">
                  <div className="text-lg font-bold">{totalComments}</div>
                  <div className="text-[11px] text-muted-foreground">Comments</div>
                </div>
              </div>
            </div>

            {/* Portal details */}
            <div>
              <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Details
              </h3>
              <div className="space-y-2 text-sm">
                {portal.description && (
                  <p className="text-muted-foreground">{portal.description}</p>
                )}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Created</span>
                  <span>{formatShortDate(portal.createdAt)}</span>
                </div>
                {pendingCount > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Pending review</span>
                    <span className="font-medium text-amber-600">{pendingCount}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Compose update */}
            <div>
              <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Post update
              </h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!newUpdate.trim() || !currentUser) return
                  addUpdate.mutate({
                    portalId: portal.id,
                    content: newUpdate.trim(),
                    type: updateType,
                    createdById: currentUser.id,
                  })
                }}
                className="space-y-2"
              >
                <textarea
                  value={newUpdate}
                  onChange={(e) => setNewUpdate(e.target.value)}
                  placeholder="Share progress with client..."
                  rows={4}
                  className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                />
                <div className="flex items-center gap-2">
                  <Select
                    value={updateType}
                    onValueChange={(v) =>
                      setUpdateType(v as "update" | "deliverable")
                    }
                  >
                    <SelectTrigger className="h-8 flex-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="update">Update</SelectItem>
                      <SelectItem value="deliverable">Deliverable</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="submit"
                    size="sm"
                    className="h-8"
                    disabled={!newUpdate.trim()}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Post
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Right — Timeline feed */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="border-b px-6 py-3">
            <h3 className="text-sm font-semibold">Timeline</h3>
            <p className="text-xs text-muted-foreground">
              Updates and deliverables shared with {portal.clientName}
            </p>
          </div>

          {portal.updates.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/30" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No updates yet. Post one to share progress with your client.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-px">
              {portal.updates.map((update) => {
                const isExpanded = expandedComments.has(update.id)
                const replyText = replyTexts[update.id] ?? ""
                const hasComments = update.comments.length > 0

                return (
                  <div
                    key={update.id}
                    className="border-b px-6 py-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-start gap-3">
                      {/* Type icon */}
                      <div
                        className={cn(
                          "mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
                          update.type === "deliverable"
                            ? "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
                            : "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                        )}
                      >
                        {update.type === "deliverable" ? (
                          <FileCheck className="h-4 w-4" />
                        ) : (
                          <MessageSquare className="h-4 w-4" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        {/* Meta row */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {update.authorName}
                          </span>
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-medium",
                              update.type === "deliverable"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                                : "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                            )}
                          >
                            {update.type === "deliverable"
                              ? "Deliverable"
                              : "Update"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(update.createdAt)}
                          </span>

                          {/* Deliverable status badge */}
                          {update.type === "deliverable" && (
                            <span
                              className={cn(
                                "ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                                update.status === "approved" &&
                                  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
                                update.status === "rejected" &&
                                  "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400",
                                update.status === "none" &&
                                  "bg-muted text-muted-foreground"
                              )}
                            >
                              {update.status === "approved" && (
                                <>
                                  <CheckCircle2 className="h-3 w-3" />
                                  Approved
                                </>
                              )}
                              {update.status === "rejected" && (
                                <>
                                  <XCircle className="h-3 w-3" />
                                  Changes Requested
                                </>
                              )}
                              {update.status === "none" && (
                                <>
                                  <Clock className="h-3 w-3" />
                                  Pending
                                </>
                              )}
                            </span>
                          )}
                        </div>

                        {/* Content */}
                        <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">
                          {update.content}
                        </p>

                        {/* Comments toggle */}
                        <button
                          onClick={() => toggleComments(update.id)}
                          className={cn(
                            "mt-2 flex items-center gap-1 text-xs transition-colors",
                            hasComments
                              ? "font-medium text-primary"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          {hasComments
                            ? `${update.comments.length} comment${update.comments.length === 1 ? "" : "s"}`
                            : "Reply"}
                        </button>

                        {/* Expanded comments */}
                        {isExpanded && (
                          <div className="mt-3 space-y-2 border-l-2 border-muted pl-3">
                            {update.comments.map((comment) => (
                              <div
                                key={comment.id}
                                className="flex items-start gap-2"
                              >
                                <div
                                  className={cn(
                                    "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                                    comment.authorType === "client"
                                      ? "bg-primary/10 text-primary"
                                      : "bg-muted text-muted-foreground"
                                  )}
                                >
                                  {comment.authorName[0]?.toUpperCase()}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-medium">
                                      {comment.authorName}
                                    </span>
                                    <span
                                      className={cn(
                                        "rounded px-1 py-0.5 text-[9px] font-medium",
                                        comment.authorType === "client"
                                          ? "bg-primary/10 text-primary"
                                          : "bg-muted text-muted-foreground"
                                      )}
                                    >
                                      {comment.authorType === "client"
                                        ? "Client"
                                        : "Team"}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {formatDate(comment.createdAt)}
                                    </span>
                                  </div>
                                  <p className="text-sm leading-relaxed">
                                    {comment.content}
                                  </p>
                                </div>
                              </div>
                            ))}

                            {currentUser && (
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault()
                                  if (!replyText.trim()) return
                                  addComment.mutate({
                                    updateId: update.id,
                                    content: replyText.trim(),
                                    authorName: currentUser.name,
                                    authorType: "member",
                                  })
                                }}
                                className="flex gap-2 pt-1"
                              >
                                <Input
                                  value={replyText}
                                  onChange={(e) =>
                                    setReplyTexts((prev) => ({
                                      ...prev,
                                      [update.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="Reply as team member..."
                                  className="h-8 text-sm"
                                />
                                <Button
                                  type="submit"
                                  size="sm"
                                  className="h-8 px-2"
                                  disabled={!replyText.trim()}
                                >
                                  <Send className="h-3.5 w-3.5" />
                                </Button>
                              </form>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
