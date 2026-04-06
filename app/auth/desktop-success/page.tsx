"use client"

import { useEffect, useState } from "react"
import { Check } from "lucide-react"

export default function DesktopSuccessPage() {
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          window.close()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        {/* Success icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-green-500/30 bg-green-500/10">
          <Check className="h-8 w-8 text-green-500" />
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">
            You&apos;re signed in!
          </h1>
          <p className="text-sm text-muted-foreground">
            You can now close this window and continue using Staged.
          </p>
        </div>

        {/* Countdown */}
        <p className="text-xs text-muted-foreground">
          This window closes automatically in {countdown}s
        </p>
      </div>
    </div>
  )
}
