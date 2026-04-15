"use client"

import { useState, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { ChevronRight, FileText, Plus } from "lucide-react"
import { trpc } from "@/lib/trpc/client"
import { useCurrentUser } from "@/lib/user-context"
import { DocEditor } from "@/components/docs/doc-editor"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

function formatLongDate(date: Date) {
  return new Date(date).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function DocPage() {
  const params = useParams<{ docId: string }>()
  const router = useRouter()
  const docId = params?.docId ?? ""
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">(
    "idle"
  )
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const utils = trpc.useUtils()
  const { currentUser } = useCurrentUser()

  const { data: doc } = trpc.doc.getById.useQuery({ id: docId })
  const isTopLevel = !!doc && !doc.parentId
  const { data: children } = trpc.doc.listChildren.useQuery(
    { parentId: docId },
    { enabled: !!docId && isTopLevel }
  )

  const createChild = trpc.doc.create.useMutation({
    onSuccess: (newDoc) => {
      utils.doc.list.invalidate()
      utils.doc.listChildren.invalidate({ parentId: docId })
      if (newDoc) router.push(`/workspace/docs/${newDoc.id}`)
    },
  })

  const updateDoc = trpc.doc.update.useMutation({
    onMutate: () => setSaveStatus("saving"),
    onSuccess: () => {
      setSaveStatus("saved")
      utils.doc.list.invalidate()
      setTimeout(() => setSaveStatus("idle"), 2000)
    },
  })

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value
      updateDoc.mutate({ id: docId, title: value || "Untitled" })
    },
    [docId, updateDoc]
  )

  const handleContentUpdate = useCallback(
    (html: string) => {
      updateDoc.mutate({ id: docId, content: html })
    },
    [docId, updateDoc]
  )

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      // Focus editor on Enter
      const editorEl = document.querySelector(".ProseMirror") as HTMLElement
      editorEl?.focus()
    }
  }

  if (!doc) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const title = doc.title === "Untitled" ? "" : doc.title
  const initials = (doc.createdByName || "U")[0]?.toUpperCase() ?? "U"
  const placeholderTags = ["General", "Notes", "Draft"]

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      {/* Breadcrumb header */}
      <div className="flex h-12 items-center justify-between border-b border-border/60 px-6">
        <div className="flex items-center gap-1.5 text-[13px]">
          <button
            onClick={() => router.push("/workspace/docs")}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            My Notes
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
          <span className="font-medium text-foreground">
            {title || "Untitled"}
          </span>
          <span className="ml-3 text-[11px] text-muted-foreground">
            {saveStatus === "saving"
              ? "Saving…"
              : saveStatus === "saved"
                ? "Saved"
                : ""}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="w-full px-8 pt-8 pb-20">
          {/* Title */}
          <textarea
            ref={titleRef}
            defaultValue={title}
            onChange={handleTitleChange}
            onKeyDown={handleTitleKeyDown}
            placeholder="Untitled"
            rows={1}
            className="mb-6 w-full resize-none bg-transparent text-[40px] leading-[1.1] font-bold tracking-tight outline-none placeholder:text-muted-foreground/30"
            style={{ overflow: "hidden" }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = "auto"
              target.style.height = target.scrollHeight + "px"
            }}
          />

          {/* Meta grid */}
          <div className="mb-6 space-y-3 text-[13px]">
            <div className="grid grid-cols-[120px_1fr] items-center gap-4">
              <span className="text-muted-foreground">Created by</span>
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6 ring-1 ring-border/60">
                  <AvatarImage src={undefined} />
                  <AvatarFallback className="text-[10px]">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">
                  {doc.createdByName || "Unknown"}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-[120px_1fr] items-center gap-4">
              <span className="text-muted-foreground">Last Modified</span>
              <span>{formatLongDate(doc.updatedAt)}</span>
            </div>
            <div className="grid grid-cols-[120px_1fr] items-center gap-4">
              <span className="text-muted-foreground">Tags</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {placeholderTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground"
                  >
                    {tag}
                  </span>
                ))}
                <button className="inline-flex items-center gap-1 rounded-md border border-dashed border-border/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground">
                  <Plus className="h-3 w-3" />
                  Add new tag
                </button>
              </div>
            </div>
          </div>

          <div className="mb-4 border-t border-border/60" />

          {/* Sub-pages (only on top-level pages) */}
          {isTopLevel && (
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/80 uppercase">
                  Sub-pages
                </span>
                <button
                  onClick={() => {
                    if (!currentUser || !doc) return
                    createChild.mutate({
                      workspaceId: doc.workspaceId,
                      title: "Untitled",
                      createdById: currentUser.id,
                      parentId: doc.id,
                    })
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-dashed border-border/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground"
                >
                  <Plus className="h-3 w-3" />
                  New sub-page
                </button>
              </div>
              {children && children.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => router.push(`/workspace/docs/${child.id}`)}
                      className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-left transition-colors hover:bg-muted/40"
                    >
                      <span className="text-[14px]">
                        {child.emoji || <FileText className="h-3.5 w-3.5" />}
                      </span>
                      <span className="truncate text-[13px] font-medium">
                        {child.title || "Untitled"}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-muted-foreground">
                  No sub-pages yet. Create one to nest related notes.
                </p>
              )}
            </div>
          )}

          {isTopLevel && <div className="mb-4 border-t border-border/60" />}

          {/* Editor */}
          <DocEditor content={doc.content} onUpdate={handleContentUpdate} />
        </div>
      </div>
    </div>
  )
}
