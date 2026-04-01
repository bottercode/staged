"use client"

import { redirect } from "next/navigation"
import { trpc } from "@/lib/trpc/client"

export default function TasksPage() {
  const { data: workspace } = trpc.workspace.getDefault.useQuery()
  const { data: boards } = trpc.board.list.useQuery(
    { workspaceId: workspace?.id! },
    { enabled: !!workspace }
  )

  if (boards && boards.length > 0) {
    redirect(`/workspace/tasks/${boards[0].id}`)
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-muted-foreground text-sm">
        No boards yet. Create one from the sidebar.
      </div>
    </div>
  )
}
