import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { SidebarClient } from "@/components/sidebar-client"
import { WorkspaceOnboarding } from "@/components/workspace-onboarding"
import { bootstrapUserWorkspace } from "@/server/auth-bootstrap"
import { authOptions } from "@/lib/auth"

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect("/auth/signin")
  }
  const bootstrap = await bootstrapUserWorkspace(session.user)

  if (!bootstrap.hasMembership) {
    return <WorkspaceOnboarding />
  }

  return (
    <div className="flex h-svh gap-2 overflow-hidden bg-background p-2">
      <SidebarClient />
      <main className="flex min-w-0 flex-1 overflow-hidden rounded-2xl border border-border/60 bg-sidebar shadow-sm">
        {children}
      </main>
    </div>
  )
}
