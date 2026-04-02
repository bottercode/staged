"use client"

import Link from "next/link"
import { useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { writeSelectedWorkspaceId } from "@/lib/workspace-selection"

export function WorkspaceOnboarding() {
  const utils = trpc.useUtils()
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)

  const createWorkspace = trpc.workspace.create.useMutation({
    onSuccess: (workspace) => {
      // Fire-and-forget cache updates; do not block navigation on invalidation.
      void utils.workspace.getDefault.invalidate()
      void utils.workspace.list.invalidate()
      void utils.channel.list.invalidate()
      writeSelectedWorkspaceId(workspace.id)
      // Force a fresh server render so membership gate in workspace layout re-evaluates.
      window.location.assign("/workspace")
    },
    onError: (mutationError) => {
      setError(
        mutationError.message.includes("Failed query")
          ? "Could not create workspace right now. Please try again."
          : mutationError.message
      )
    },
  })

  return (
    <div className="flex min-h-svh flex-1 items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Welcome to Staged</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You are not in any workspace yet. Create one now or join with an invite
          link.
        </p>

        <div className="mt-6 space-y-2">
          <label htmlFor="workspace-name" className="text-sm font-medium">
            Workspace name
          </label>
          <Input
            id="workspace-name"
            value={name}
            placeholder="My Workspace"
            onChange={(event) => {
              if (error) setError(null)
              setName(event.target.value)
            }}
          />
        </div>

        {error ? (
          <p className="mt-3 text-sm text-destructive">{error}</p>
        ) : null}

        <div className="mt-6 flex items-center gap-3">
          <Button
            disabled={!name.trim() || createWorkspace.isPending}
            onClick={() => createWorkspace.mutate({ name: name.trim() })}
          >
            {createWorkspace.isPending ? "Creating..." : "Create workspace"}
          </Button>
          <Button asChild variant="outline">
            <Link href="/join">Join with invite link</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
