"use client"

import { Sidebar } from "@/components/sidebar"

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-svh overflow-hidden">
      <Sidebar />
      <main className="flex min-w-0 flex-1">{children}</main>
    </div>
  )
}
