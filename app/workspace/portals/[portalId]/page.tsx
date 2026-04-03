"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { skipToken } from "@tanstack/react-query"
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
  X,
  CalendarDays,
  Flag,
  Tag,
  UserRound,
} from "lucide-react"
import { trpc } from "@/lib/trpc/client"
import { useCurrentUser } from "@/lib/user-context"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
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
  const params = useParams<{ portalId: string }>()
  const portalId = params?.portalId ?? ""
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
  const [showCreateIssueDialog, setShowCreateIssueDialog] = useState(false)
  const [issueTitle, setIssueTitle] = useState("")
  const [issueSection, setIssueSection] = useState<
    "todo" | "in_progress" | "done"
  >("todo")
  const [issueDescription, setIssueDescription] = useState("")
  const [issuePriority, setIssuePriority] = useState<
    "low" | "medium" | "high" | "urgent"
  >("medium")
  const [issueAssigneeId, setIssueAssigneeId] = useState("unassigned")
  const [issueDueDate, setIssueDueDate] = useState("")
  const [issueLabels, setIssueLabels] = useState("")
  const [issueBoardIds, setIssueBoardIds] = useState<string[]>([])
  const utils = trpc.useUtils()

  const { data: portal } = trpc.portal.getById.useQuery(
    { id: portalId },
    { refetchInterval: 3000 }
  )
  const { data: boards } = trpc.board.list.useQuery(
    portal ? { workspaceId: portal.workspaceId } : skipToken
  )
  const { data: workspaceMembers } = trpc.workspace.getMembers.useQuery(
    portal ? { workspaceId: portal.workspaceId } : skipToken
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

  const createIssue = trpc.portal.createIssue.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.portal.getById.invalidate({ id: portalId }),
        utils.board.list.invalidate(),
        utils.board.getById.invalidate(),
      ])
      setIssueTitle("")
      setIssueSection("todo")
      setIssueDescription("")
      setIssuePriority("medium")
      setIssueAssigneeId("unassigned")
      setIssueDueDate("")
      setIssueLabels("")
      setIssueBoardIds([])
      setShowCreateIssueDialog(false)
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
    navigator.clipboard.writeText(
      window.location.origin + `/portal/${portal?.slug}`
    )
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
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={copyLink}
          >
            {copied ? (
              <Check className="mr-1 h-3 w-3" />
            ) : (
              <Copy className="mr-1 h-3 w-3" />
            )}
            {copied ? "Copied" : "Copy link"}
          </Button>
          <a href={portalUrl} target="_blank" rel="noopener noreferrer">
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
          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            {/* Client info card */}
            <div>
              <h3 className="mb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
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
              <h3 className="mb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                Overview
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border bg-card px-3 py-2">
                  <div className="text-lg font-bold">
                    {portal.updates.length}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Updates
                  </div>
                </div>
                <div className="rounded-lg border bg-card px-3 py-2">
                  <div className="text-lg font-bold">{deliverableCount}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Deliverables
                  </div>
                </div>
                <div className="rounded-lg border bg-card px-3 py-2">
                  <div className="text-lg font-bold text-emerald-600">
                    {approvedCount}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Approved
                  </div>
                </div>
                <div className="rounded-lg border bg-card px-3 py-2">
                  <div className="text-lg font-bold">{totalComments}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Comments
                  </div>
                </div>
              </div>
            </div>

            {/* Portal details */}
            <div>
              <h3 className="mb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
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
                    <span className="text-muted-foreground">
                      Pending review
                    </span>
                    <span className="font-medium text-amber-600">
                      {pendingCount}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Compose update */}
            <div>
              <h3 className="mb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
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

            {/* Create issue */}
            <div>
              <h3 className="mb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                Issues
              </h3>
              <div className="rounded-lg border bg-card p-3">
                <p className="text-sm font-medium">Create issue from portal</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create a task directly in one or multiple boards.
                </p>
                <Button
                  size="sm"
                  className="mt-3 h-8 w-full"
                  onClick={() => {
                    if (!issueBoardIds.length && boards?.length) {
                      const defaultBoardId =
                        portal.boardId &&
                        boards.some((b) => b.id === portal.boardId)
                          ? portal.boardId
                          : boards[0]?.id
                      if (defaultBoardId) {
                        setIssueBoardIds([defaultBoardId])
                      }
                    }
                    setShowCreateIssueDialog(true)
                  }}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  New issue
                </Button>
              </div>
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
                        {update.type === "deliverable" &&
                          update.status !== "none" &&
                          update.reviewedByName && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {update.status === "approved"
                                ? "Approved"
                                : "Changes requested"}{" "}
                              by {update.reviewedByName}
                              {update.reviewedAt
                                ? ` • ${formatDate(update.reviewedAt)}`
                                : ""}
                            </p>
                          )}

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

      <Dialog
        open={showCreateIssueDialog}
        onOpenChange={(open) => {
          if (open && !issueBoardIds.length && boards?.length) {
            const defaultBoardId =
              portal.boardId && boards.some((b) => b.id === portal.boardId)
                ? portal.boardId
                : boards[0]?.id
            if (defaultBoardId) setIssueBoardIds([defaultBoardId])
          }
          setShowCreateIssueDialog(open)
        }}
      >
        <DialogContent
          className="flex h-[86vh] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:h-[84vh] sm:w-[calc(100vw-4rem)] sm:max-w-[calc(100vw-4rem)] xl:max-w-[1360px]"
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Create issue</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (
                !currentUser ||
                !portal ||
                !issueTitle.trim() ||
                issueBoardIds.length === 0
              ) {
                return
              }
              createIssue.mutate({
                portalId: portal.id,
                boardIds: issueBoardIds,
                title: issueTitle.trim(),
                section: issueSection,
                description: issueDescription.trim() || undefined,
                priority: issuePriority,
                dueDate: issueDueDate
                  ? new Date(`${issueDueDate}T00:00:00`).toISOString()
                  : undefined,
                assigneeId:
                  issueAssigneeId === "unassigned"
                    ? undefined
                    : issueAssigneeId,
                labels: issueLabels
                  .split(",")
                  .map((label) => label.trim())
                  .filter(Boolean),
                createdById: currentUser.id,
              })
            }}
            className="flex h-full flex-col"
          >
            <div className="flex-1 overflow-y-auto">
              <div className="px-6 pt-6 pb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs tracking-wide text-muted-foreground uppercase">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    <span>Issue</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateIssueDialog(false)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <Textarea
                  value={issueTitle}
                  onChange={(e) => setIssueTitle(e.target.value)}
                  placeholder="Issue title"
                  autoFocus
                  className="mt-3 min-h-[56px] resize-none border-0 px-0 text-4xl leading-tight font-semibold shadow-none focus-visible:ring-0"
                />

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Select
                    value={issueSection}
                    onValueChange={(value) =>
                      setIssueSection(value as "todo" | "in_progress" | "done")
                    }
                  >
                    <SelectTrigger className="h-8 w-[150px] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>

                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
                      >
                        <Flag className="h-4 w-4 text-amber-500" />
                        {issuePriority === "urgent"
                          ? "P1"
                          : issuePriority === "high"
                            ? "P2"
                            : issuePriority === "medium"
                              ? "P3"
                              : "P4"}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="bottom"
                      align="start"
                      className="w-auto p-1"
                    >
                      <div className="flex items-center gap-1">
                        {[
                          { id: "urgent", label: "P1" },
                          { id: "high", label: "P2" },
                          { id: "medium", label: "P3" },
                          { id: "low", label: "P4" },
                        ].map((priority) => (
                          <button
                            key={priority.id}
                            type="button"
                            onClick={() =>
                              setIssuePriority(
                                priority.id as
                                  | "low"
                                  | "medium"
                                  | "high"
                                  | "urgent"
                              )
                            }
                            className={cn(
                              "rounded-md px-2 py-1 text-xs font-semibold",
                              issuePriority === priority.id
                                ? "bg-muted text-foreground"
                                : "text-muted-foreground hover:bg-muted"
                            )}
                          >
                            {priority.label}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
                      >
                        <CalendarDays className="h-4 w-4" />
                        {issueDueDate
                          ? new Date(
                              `${issueDueDate}T00:00:00`
                            ).toLocaleDateString()
                          : "No due date"}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="bottom"
                      align="start"
                      className="w-64 p-3"
                    >
                      <Input
                        type="date"
                        value={issueDueDate}
                        onChange={(e) => setIssueDueDate(e.target.value)}
                      />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
                      >
                        <Tag className="h-4 w-4" />
                        {issueLabels.trim()
                          ? `${issueLabels.split(",").filter((v) => v.trim()).length} labels`
                          : "Add label"}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="bottom"
                      align="start"
                      className="w-80 p-3"
                    >
                      <Input
                        value={issueLabels}
                        onChange={(e) => setIssueLabels(e.target.value)}
                        placeholder="bug, customer, sprint"
                      />
                      <p className="mt-2 text-xs text-muted-foreground">
                        Enter comma-separated labels
                      </p>
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
                      >
                        <UserRound className="h-4 w-4" />
                        {issueAssigneeId === "unassigned"
                          ? "No assignees"
                          : (workspaceMembers?.find(
                              (member) => member.userId === issueAssigneeId
                            )?.name ?? "No assignees")}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="bottom"
                      align="start"
                      className="w-80 p-2"
                    >
                      <button
                        type="button"
                        onClick={() => setIssueAssigneeId("unassigned")}
                        className={cn(
                          "flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                          issueAssigneeId === "unassigned" ? "bg-muted" : ""
                        )}
                      >
                        Unassigned
                      </button>
                      <div className="mt-1 max-h-52 space-y-1 overflow-y-auto">
                        {workspaceMembers?.map((member) => (
                          <button
                            key={member.userId}
                            type="button"
                            onClick={() => setIssueAssigneeId(member.userId)}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted",
                              issueAssigneeId === member.userId
                                ? "bg-muted"
                                : ""
                            )}
                          >
                            <Avatar className="h-6 w-6">
                              <AvatarImage
                                src={member.avatarUrl ?? undefined}
                              />
                              <AvatarFallback className="text-[10px]">
                                {member.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="truncate text-sm">
                                {member.name}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {member.email}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
                      >
                        <Globe className="h-4 w-4" />
                        {issueBoardIds.length === 0
                          ? "Select boards"
                          : `${issueBoardIds.length} board${issueBoardIds.length === 1 ? "" : "s"}`}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="bottom"
                      align="start"
                      className="w-80 p-2"
                    >
                      <div className="max-h-56 space-y-1 overflow-y-auto">
                        {boards?.map((board) => {
                          const selected = issueBoardIds.includes(board.id)
                          return (
                            <label
                              key={board.id}
                              className={cn(
                                "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                                selected ? "bg-muted" : ""
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={(e) => {
                                  setIssueBoardIds((prev) => {
                                    if (e.target.checked)
                                      return [...prev, board.id]
                                    return prev.filter((id) => id !== board.id)
                                  })
                                }}
                                className="h-4 w-4"
                              />
                              <span>{board.name}</span>
                            </label>
                          )
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <Separator className="my-4" />

                <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Description
                </p>
                <Textarea
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  placeholder="Write more details about this issue..."
                  className="min-h-[260px] resize-none border px-3 py-3 text-base leading-relaxed"
                />

                {createIssue.error?.message && (
                  <p className="mt-3 text-xs text-red-600">
                    {createIssue.error.message}
                  </p>
                )}
              </div>
            </div>

            <div className="border-t px-6 py-3">
              <div className="flex items-center justify-end">
                <Button
                  type="submit"
                  disabled={
                    createIssue.isPending ||
                    !issueTitle.trim() ||
                    issueBoardIds.length === 0
                  }
                >
                  {createIssue.isPending ? "Creating..." : "Create Issue"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
