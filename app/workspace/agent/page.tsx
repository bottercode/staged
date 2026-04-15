import { headers } from "next/headers"
import { AgentPanel } from "@/components/agent/agent-panel"

export default async function AgentPage() {
  const hdrs = await headers()
  const ua = hdrs.get("user-agent") || ""
  const isDesktop = /Electron|StagedDesktop/i.test(ua)

  return (
    <div className="flex h-full w-full flex-col">
      <AgentPanel initialIsDesktop={isDesktop} />
    </div>
  )
}
