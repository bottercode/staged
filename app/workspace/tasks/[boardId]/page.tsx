"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { LayoutGrid, SlidersHorizontal, List } from "lucide-react"
import { trpc } from "@/lib/trpc/client"
import { BoardView } from "@/components/tasks/board-view"
import { cn } from "@/lib/utils"

type ViewMode = "board" | "list"
type FilterMode = "all" | "active"

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const [viewMode, setViewMode] = useState<ViewMode>("board")
  const [filterMode, setFilterMode] = useState<FilterMode>("all")
  const { data: board } = trpc.board.getById.useQuery({
    id: boardId,
    filterMode,
  })

  if (!board) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading board...</div>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Board header */}
      <div className="flex h-12 items-center gap-2 border-b px-4">
        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">{board.name}</span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filter
        </button>

        <div className="flex items-center gap-2">
          {/* All / Active toggle */}
          <div className="flex items-center rounded-md border bg-muted/40 p-0.5">
            <button
              onClick={() => setFilterMode("all")}
              className={cn(
                "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                filterMode === "all"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilterMode("active")}
              className={cn(
                "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                filterMode === "active"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Active
            </button>
          </div>

          {/* Board / List view toggle */}
          <div className="flex items-center rounded-md border bg-muted/40 p-0.5">
            <button
              onClick={() => setViewMode("board")}
              className={cn(
                "rounded-sm p-1.5 transition-colors",
                viewMode === "board"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "rounded-sm p-1.5 transition-colors",
                viewMode === "list"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Kanban board */}
      <BoardView
        boardId={board.id}
        workspaceId={board.workspaceId}
        columns={board.columns}
        filterMode={filterMode}
      />
    </div>
  )
}
