"use client"

import { useState, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { DocEditor } from "@/components/docs/doc-editor"
import { cn } from "@/lib/utils"

function timeAgo(date: Date) {
  const seconds = Math.floor(
    (new Date().getTime() - new Date(date).getTime()) / 1000
  )
  if (seconds < 60) return "Just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function DocPage() {
  const { docId } = useParams<{ docId: string }>()
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">(
    "idle"
  )
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const utils = trpc.useUtils()

  const { data: doc } = trpc.doc.getById.useQuery({ id: docId })

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

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Doc header */}
      <div className="flex h-10 items-center justify-end gap-2 border-b px-4">
        <span className="text-xs text-muted-foreground">
          {saveStatus === "saving"
            ? "Saving..."
            : saveStatus === "saved"
              ? "Saved"
              : `Edited ${timeAgo(doc.updatedAt)}`}
        </span>
        {doc.createdByName && (
          <span className="text-xs text-muted-foreground">
            by {doc.createdByName}
          </span>
        )}
      </div>

      {/* Title area */}
      <div className="mx-auto w-full max-w-3xl px-6 pt-10 pb-1">
        <textarea
          ref={titleRef}
          defaultValue={doc.title === "Untitled" ? "" : doc.title}
          onChange={handleTitleChange}
          onKeyDown={handleTitleKeyDown}
          placeholder="Untitled"
          rows={1}
          className="w-full resize-none bg-transparent text-4xl font-bold leading-tight outline-none placeholder:text-muted-foreground/40"
          style={{ overflow: "hidden" }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement
            target.style.height = "auto"
            target.style.height = target.scrollHeight + "px"
          }}
        />
      </div>

      {/* Editor */}
      <DocEditor content={doc.content} onUpdate={handleContentUpdate} />
    </div>
  )
}
