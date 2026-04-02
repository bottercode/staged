"use client"

import { useEffect } from "react"
import { signIn, useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const callbackUrl = searchParams?.get("callbackUrl") || "/workspace"

  useEffect(() => {
    if (session?.user) {
      router.replace("/workspace")
    }
  }, [router, session?.user])

  const hasGoogleProvider = Boolean(
    process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true"
  )

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Sign in to Staged</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Continue with Google to access your workspace.
        </p>

        {hasGoogleProvider ? (
          <div className="mt-6">
            <Button
              type="button"
              className="w-full"
              disabled={status === "loading"}
              onClick={() => signIn("google", { callbackUrl })}
            >
              Continue with Google
            </Button>
          </div>
        ) : (
          <div className="mt-6 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            Google auth is not configured. Set `AUTH_GOOGLE_ID`,
            `AUTH_GOOGLE_SECRET`, and `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true`.
          </div>
        )}
      </div>
    </div>
  )
}
