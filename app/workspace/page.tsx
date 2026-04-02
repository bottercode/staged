"use client"

import { redirect } from "next/navigation"
import { skipToken } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { readSelectedWorkspaceId } from "@/lib/workspace-selection"

export default function WorkspacePage() {
  const [preferredWorkspaceId, setPreferredWorkspaceId] = useState<string | undefined>(
    undefined
  )
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreferredWorkspaceId(readSelectedWorkspaceId() || undefined)
  }, [])
  const { data: workspace } = trpc.workspace.getDefault.useQuery(
    preferredWorkspaceId ? { preferredWorkspaceId } : undefined
  )
  const { data: channels } = trpc.channel.list.useQuery(
    workspace ? { workspaceId: workspace.id } : skipToken
  )

  if (channels && channels.length > 0) {
    redirect(`/workspace/channel/${channels[0].id}`)
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-muted-foreground text-sm">
        Select a channel to start chatting
      </div>
    </div>
  )
}
