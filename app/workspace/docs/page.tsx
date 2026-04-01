"use client"

import { FileText } from "lucide-react"

export default function DocsPage() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
        <p className="mt-3 text-sm text-muted-foreground">
          Select a doc or create one to get started
        </p>
      </div>
    </div>
  )
}
