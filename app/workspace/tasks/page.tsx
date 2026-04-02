"use client"

import { useRouter } from "next/navigation"
import { skipToken } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { readSelectedWorkspaceId } from "@/lib/workspace-selection"

export default function TasksPage() {
  const router = useRouter()
  const [preferredWorkspaceId, setPreferredWorkspaceId] = useState<string | undefined>(
    undefined
  )
  const didAutoCreateBoardRef = useRef(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreferredWorkspaceId(readSelectedWorkspaceId() || undefined)
  }, [])

  const { data: workspace } = trpc.workspace.getDefault.useQuery(
    preferredWorkspaceId ? { preferredWorkspaceId } : undefined
  )

  const { data: boards } = trpc.board.list.useQuery(
    workspace ? { workspaceId: workspace.id } : skipToken
  )

  const createBoard = trpc.board.create.useMutation()

  useEffect(() => {
    if (!boards || boards.length === 0) return
    router.replace(`/workspace/tasks/${boards[0].id}`)
  }, [boards, router])

  useEffect(() => {
    if (!workspace || !boards || boards.length > 0 || didAutoCreateBoardRef.current) return
    didAutoCreateBoardRef.current = true
    createBoard
      .mutateAsync({
        workspaceId: workspace.id,
        name: "Backlog",
      })
      .then((board) => {
        router.replace(`/workspace/tasks/${board.id}`)
      })
      .catch(() => {
        didAutoCreateBoardRef.current = false
      })
  }, [workspace, boards, createBoard, router])

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-muted-foreground text-sm">
        {createBoard.isPending
          ? "Creating your default board..."
          : "No boards yet. Creating a default board..."}
      </div>
    </div>
  )
}
