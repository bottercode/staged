"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

function extractToken(raw: string) {
  const value = raw.trim()
  if (!value) return ""

  if (!value.includes("/")) return value

  try {
    const url = new URL(value)
    const parts = url.pathname.split("/").filter(Boolean)
    if (parts.length >= 2 && parts[0] === "join") return parts[1]
    return ""
  } catch {
    const normalized = value.replace(/^\/+/, "")
    const parts = normalized.split("/")
    if (parts.length >= 2 && parts[0] === "join") return parts[1]
    return ""
  }
}

export default function JoinWorkspacePage() {
  const router = useRouter()
  const [inviteValue, setInviteValue] = useState("")
  const token = useMemo(() => extractToken(inviteValue), [inviteValue])

  return (
    <div className="flex min-h-svh flex-1 items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Join a workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste an invite link or token to join an existing workspace.
        </p>

        <div className="mt-6 space-y-2">
          <label htmlFor="invite-link" className="text-sm font-medium">
            Invite link or token
          </label>
          <Input
            id="invite-link"
            value={inviteValue}
            placeholder="https://.../join/<token>"
            onChange={(event) => setInviteValue(event.target.value)}
          />
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button
            disabled={!token}
            onClick={() => {
              if (!token) return
              router.push(`/join/${token}`)
            }}
          >
            Continue
          </Button>
          <Button variant="outline" onClick={() => router.push("/workspace")}>Back</Button>
        </div>
      </div>
    </div>
  )
}
