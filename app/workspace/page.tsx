"use client"

import { redirect } from "next/navigation"
import { skipToken } from "@tanstack/react-query"
import { trpc } from "@/lib/trpc/client"

export default function WorkspacePage() {
  const { data: workspace } = trpc.workspace.getDefault.useQuery()
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
