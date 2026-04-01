"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import {
  Globe,
  FileCheck,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  ChevronDown,
  ChevronRight,

} from "lucide-react"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function ProgressBar({ percentage }: { percentage: number }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-emerald-500 transition-all"
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

export default function ClientPortalPage() {
  const { slug } = useParams<{ slug: string }>()
  const [clientName, setClientName] = useState("")
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({})
  const [expandedComments, setExpandedComments] = useState<Set<string>>(
    new Set()
  )
  const utils = trpc.useUtils()

  const { data: portal, isLoading } = trpc.portal.getBySlug.useQuery(
    { slug },
    { refetchInterval: 3000 }
  )

  const addComment = trpc.portal.addComment.useMutation({
    onSuccess: (_, variables) => {
      utils.portal.getBySlug.invalidate({ slug })
      setCommentTexts((prev) => ({ ...prev, [variables.updateId]: "" }))
    },
  })

  const approveDeliverable = trpc.portal.approveDeliverable.useMutation({
    onSuccess: () => utils.portal.getBySlug.invalidate({ slug }),
  })

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!portal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Globe className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">Portal not found</p>
        </div>
      </div>
    )
  }

  const toggleComments = (updateId: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev)
      if (next.has(updateId)) next.delete(updateId)
      else next.add(updateId)
      return next
    })
  }

  const deliverableCount = portal.updates.filter(
    (u) => u.type === "deliverable"
  ).length
  const approvedCount = portal.updates.filter(
    (u) => u.status === "approved"
  ).length
  const pendingCount = portal.updates.filter(
    (u) => u.type === "deliverable" && u.status === "none"
  ).length

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex h-14 items-center gap-3 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            {portal.name[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-sm leading-tight font-semibold">
              {portal.name}
            </h1>
            {portal.description && (
              <p className="truncate text-xs text-muted-foreground">
                {portal.description}
              </p>
            )}
          </div>
          {clientName && (
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                {clientName[0]?.toUpperCase()}
              </div>
              {clientName}
            </div>
          )}
        </div>
      </header>

      <div className="flex">
        {/* Left sidebar — progress + info */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-72 flex-shrink-0 border-r lg:flex lg:flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {/* Name input if not set */}
            {!clientName && (
              <div className="rounded-lg border bg-primary/5 p-3">
                <p className="mb-2 text-xs font-medium">
                  Enter your name to comment
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    const input = (
                      e.target as HTMLFormElement
                    ).elements.namedItem("name") as HTMLInputElement
                    if (input.value.trim()) setClientName(input.value.trim())
                  }}
                  className="flex gap-2"
                >
                  <Input
                    name="name"
                    placeholder="Your name"
                    className="h-8 text-sm"
                  />
                  <Button type="submit" size="sm" className="h-8">
                    Go
                  </Button>
                </form>
              </div>
            )}

            {/* Progress */}
            {portal.progress && (
              <div>
                <h3 className="mb-3 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                  Progress
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Overall completion
                    </span>
                    <span className="text-sm font-bold text-emerald-600">
                      {portal.progress.percentage}%
                    </span>
                  </div>
                  <ProgressBar percentage={portal.progress.percentage} />
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {portal.progress.columns.map((col) => (
                      <div
                        key={col.name}
                        className="rounded-md border bg-card px-2 py-1.5 text-center"
                      >
                        <div className="text-sm font-bold">{col.count}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {col.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Stats */}
            <div>
              <h3 className="mb-3 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                Activity
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Total updates</span>
                  <span className="font-medium">{portal.updates.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Deliverables</span>
                  <span className="font-medium">{deliverableCount}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Approved</span>
                  <span className="font-medium text-emerald-600">
                    {approvedCount}
                  </span>
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
          </div>
        </aside>

        {/* Main feed */}
        <main className="flex-1">
          {/* Mobile: name input + progress inline */}
          <div className="space-y-4 border-b p-4 lg:hidden">
            {!clientName && (
              <div className="rounded-lg border bg-primary/5 p-3">
                <p className="mb-2 text-xs font-medium">
                  Enter your name to comment
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    const input = (
                      e.target as HTMLFormElement
                    ).elements.namedItem("name") as HTMLInputElement
                    if (input.value.trim()) setClientName(input.value.trim())
                  }}
                  className="flex gap-2"
                >
                  <Input
                    name="name"
                    placeholder="Your name"
                    className="h-8 text-sm"
                  />
                  <Button type="submit" size="sm" className="h-8">
                    Go
                  </Button>
                </form>
              </div>
            )}
            {portal.progress && (
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <ProgressBar percentage={portal.progress.percentage} />
                </div>
                <span className="text-sm font-bold text-emerald-600">
                  {portal.progress.percentage}%
                </span>
              </div>
            )}
          </div>

          {/* Timeline header */}
          <div className="border-b px-6 py-3">
            <h2 className="text-sm font-semibold">Updates</h2>
            <p className="text-xs text-muted-foreground">
              Latest activity on your project
            </p>
          </div>

          {portal.updates.length === 0 ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-center">
                <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/30" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No updates yet
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-px">
              {portal.updates.map((update) => {
                const isExpanded = expandedComments.has(update.id)
                const commentText = commentTexts[update.id] ?? ""
                const hasComments = update.comments.length > 0

                return (
                  <div
                    key={update.id}
                    className="border-b px-6 py-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-start gap-3">
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
                        {/* Meta */}
                        <div className="flex flex-wrap items-center gap-2">
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

                        {/* Deliverable actions */}
                        {update.type === "deliverable" &&
                          update.status === "none" &&
                          clientName && (
                            <div className="mt-3 flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                                onClick={() =>
                                  approveDeliverable.mutate({
                                    updateId: update.id,
                                    status: "approved",
                                  })
                                }
                              >
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-red-500 hover:bg-red-50 hover:text-red-600"
                                onClick={() =>
                                  approveDeliverable.mutate({
                                    updateId: update.id,
                                    status: "rejected",
                                  })
                                }
                              >
                                <XCircle className="mr-1 h-3 w-3" />
                                Request Changes
                              </Button>
                            </div>
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
                            : "Add a comment"}
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

                            {clientName && (
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault()
                                  if (!commentText.trim()) return
                                  addComment.mutate({
                                    updateId: update.id,
                                    content: commentText.trim(),
                                    authorName: clientName,
                                    authorType: "client",
                                  })
                                }}
                                className="flex gap-2 pt-1"
                              >
                                <Input
                                  value={commentText}
                                  onChange={(e) =>
                                    setCommentTexts((prev) => ({
                                      ...prev,
                                      [update.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="Write a comment..."
                                  className="h-8 text-sm"
                                />
                                <Button
                                  type="submit"
                                  size="sm"
                                  className="h-8 px-2"
                                  disabled={!commentText.trim()}
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
        </main>
      </div>

      {/* Powered by Staged badge */}
      <footer className="fixed right-4 bottom-4 z-50">
        <a
          href="https://staged.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-full border bg-card/95 px-3 py-1.5 shadow-sm backdrop-blur transition-shadow hover:shadow-md"
        >
          <div className="flex h-4 w-4 items-center justify-center rounded bg-primary text-[8px] font-bold text-primary-foreground">
            S
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">
            Powered by <span className="text-foreground">Staged</span>
          </span>
        </a>
      </footer>
    </div>
  )
}
