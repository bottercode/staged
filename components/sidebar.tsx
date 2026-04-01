"use client"

import {
  Hash,
  MessageSquare,
  Plus,
  LayoutGrid,
  MessagesSquare,
  Globe,
  FileText,
  Bot,
  Settings,
} from "lucide-react"
import { useRouter, usePathname } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { useCurrentUser } from "@/lib/user-context"
import { useNotifications } from "@/hooks/use-notifications"
import { UserSwitcher } from "./user-switcher"
import { ChannelCreateDialog } from "./channel-create-dialog"
import { DmCreateDialog } from "./dm-create-dialog"
import { BoardCreateDialog } from "./tasks/board-create-dialog"
import { PortalCreateDialog } from "./portal-create-dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useMemo, useState } from "react"
import { AgentSettingsDialog } from "./agent-settings-dialog"

type Tab = "chat" | "tasks" | "portals" | "docs" | "agent"

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
      {count > 99 ? "99+" : count}
    </span>
  )
}

function NavRail({
  activeTab,
  onTabChange,
  onOpenSettings,
  totalUnread,
  workspaceName,
}: {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  onOpenSettings: () => void
  totalUnread: number
  workspaceName: string
}) {
  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex w-12 flex-shrink-0 flex-col items-center gap-1 border-r bg-sidebar py-3">
        {/* Workspace initial */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
              {workspaceName[0]?.toUpperCase() ?? "S"}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">{workspaceName}</TooltipContent>
        </Tooltip>

        <div className="mb-1 h-px w-6 bg-border" />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onTabChange("chat")}
              className={cn(
                "relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                activeTab === "chat"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <MessagesSquare className="h-4.5 w-4.5" />
              {totalUnread > 0 && activeTab !== "chat" && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
                  {totalUnread > 9 ? "9+" : totalUnread}
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Chat</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onTabChange("tasks")}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                activeTab === "tasks"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <LayoutGrid className="h-4.5 w-4.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Tasks</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onTabChange("docs")}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                activeTab === "docs"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <FileText className="h-4.5 w-4.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Docs</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onTabChange("portals")}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                activeTab === "portals"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <Globe className="h-4.5 w-4.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Client Portals</TooltipContent>
        </Tooltip>

        <div className="mt-auto" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onTabChange("agent")}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                activeTab === "agent"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <Bot className="h-4.5 w-4.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">AI Agent</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onOpenSettings}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <Settings className="h-4.5 w-4.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Agent Settings</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}

function ChatSidebar({
  channels,
  dmRooms,
  unreadCounts,
  pathname,
  router,
  onCreateChannel,
  onCreateDm,
}: {
  channels: { id: string; name: string }[] | undefined
  dmRooms:
    | {
        id: string
        members: { id: string; name: string; avatarUrl: string | null }[]
      }[]
    | undefined
  unreadCounts: Record<string, number>
  pathname: string
  router: ReturnType<typeof useRouter>
  onCreateChannel: () => void
  onCreateDm: () => void
}) {
  return (
    <>
      <div className="flex h-12 items-center gap-2 border-b px-4">
        <span className="text-sm font-semibold">Chat</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* Channels */}
          <div className="mb-1 flex items-center justify-between px-2">
            <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Channels
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={onCreateChannel}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {channels?.map((channel) => {
            const isActive = pathname.includes(`/channel/${channel.id}`)
            const unread = unreadCounts[channel.id] ?? 0
            return (
              <button
                key={channel.id}
                onClick={() => router.push(`/workspace/channel/${channel.id}`)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : unread > 0
                      ? "font-semibold text-sidebar-foreground hover:bg-sidebar-accent/50"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                )}
              >
                <Hash className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{channel.name}</span>
                <UnreadBadge count={unread} />
              </button>
            )
          })}

          <Separator className="my-3" />

          {/* DMs */}
          <div className="mb-1 flex items-center justify-between px-2">
            <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Direct Messages
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={onCreateDm}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {dmRooms?.map((room) => {
            const isActive = pathname.includes(`/dm/${room.id}`)
            const otherUser = room.members[0]
            const unread = unreadCounts[room.id] ?? 0
            return (
              <button
                key={room.id}
                onClick={() => router.push(`/workspace/dm/${room.id}`)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : unread > 0
                      ? "font-semibold text-sidebar-foreground hover:bg-sidebar-accent/50"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                )}
              >
                <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{otherUser?.name ?? "Unknown"}</span>
                <UnreadBadge count={unread} />
              </button>
            )
          })}
        </div>
      </ScrollArea>
    </>
  )
}

function TasksSidebar({
  boards,
  pathname,
  router,
  onCreateBoard,
}: {
  boards: { id: string; name: string }[] | undefined
  pathname: string
  router: ReturnType<typeof useRouter>
  onCreateBoard: () => void
}) {
  return (
    <>
      <div className="flex h-12 items-center gap-2 border-b px-4">
        <span className="text-sm font-semibold">Tasks</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          <div className="mb-1 flex items-center justify-between px-2">
            <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Boards
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={onCreateBoard}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {boards?.map((board) => {
            const isActive = pathname.includes(`/tasks/${board.id}`)
            return (
              <button
                key={board.id}
                onClick={() => router.push(`/workspace/tasks/${board.id}`)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{board.name}</span>
              </button>
            )
          })}

          {(!boards || boards.length === 0) && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No boards yet
            </p>
          )}
        </div>
      </ScrollArea>
    </>
  )
}

function PortalsSidebar({
  portals,
  pathname,
  router,
  onCreatePortal,
}: {
  portals:
    | { id: string; name: string; clientName: string; status: string }[]
    | undefined
  pathname: string
  router: ReturnType<typeof useRouter>
  onCreatePortal: () => void
}) {
  return (
    <>
      <div className="flex h-12 items-center gap-2 border-b px-4">
        <span className="text-sm font-semibold">Client Portals</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          <div className="mb-1 flex items-center justify-between px-2">
            <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Portals
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={onCreatePortal}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {portals?.map((portal) => {
            const isActive = pathname.includes(`/portals/${portal.id}`)
            return (
              <button
                key={portal.id}
                onClick={() => router.push(`/workspace/portals/${portal.id}`)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                )}
              >
                <Globe className="h-3.5 w-3.5 flex-shrink-0" />
                <div className="min-w-0 flex-1 text-left">
                  <span className="block truncate">{portal.name}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {portal.clientName}
                  </span>
                </div>
              </button>
            )
          })}

          {(!portals || portals.length === 0) && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No portals yet
            </p>
          )}
        </div>
      </ScrollArea>
    </>
  )
}

function DocsSidebar({
  docs,
  pathname,
  router,
  onCreateDoc,
}: {
  docs: { id: string; title: string; emoji: string | null }[] | undefined
  pathname: string
  router: ReturnType<typeof useRouter>
  onCreateDoc: () => void
}) {
  return (
    <>
      <div className="flex h-12 items-center gap-2 border-b px-4">
        <span className="text-sm font-semibold">Docs</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          <div className="mb-1 flex items-center justify-between px-2">
            <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              My Docs
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={onCreateDoc}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {docs?.map((doc) => {
            const isActive = pathname.includes(`/docs/${doc.id}`)
            return (
              <button
                key={doc.id}
                onClick={() => router.push(`/workspace/docs/${doc.id}`)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                )}
              >
                <span className="flex-shrink-0 text-sm">
                  {doc.emoji || "📄"}
                </span>
                <span className="truncate">{doc.title || "Untitled"}</span>
              </button>
            )
          })}

          {(!docs || docs.length === 0) && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No docs yet
            </p>
          )}
        </div>
      </ScrollArea>
    </>
  )
}

export function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const { currentUser } = useCurrentUser()
  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [showCreateDm, setShowCreateDm] = useState(false)
  const [showCreateBoard, setShowCreateBoard] = useState(false)
  const [showCreatePortal, setShowCreatePortal] = useState(false)
  const [showAgentSettings, setShowAgentSettings] = useState(false)

  // Determine active tab from URL
  const activeTab: Tab = pathname.includes("/agent")
    ? "agent"
    : pathname.includes("/portals")
      ? "portals"
      : pathname.includes("/docs")
        ? "docs"
        : pathname.includes("/tasks")
          ? "tasks"
          : "chat"

  const { data: workspace } = trpc.workspace.getDefault.useQuery()
  const { data: channels } = trpc.channel.list.useQuery(
    { workspaceId: workspace?.id! },
    { enabled: !!workspace }
  )
  const { data: dmRooms } = trpc.dm.list.useQuery(
    { workspaceId: workspace?.id!, userId: currentUser?.id! },
    { enabled: !!workspace && !!currentUser }
  )
  const { data: boards } = trpc.board.list.useQuery(
    { workspaceId: workspace?.id! },
    { enabled: !!workspace }
  )
  const { data: portalList } = trpc.portal.list.useQuery(
    { workspaceId: workspace?.id! },
    { enabled: !!workspace }
  )
  const { data: docList } = trpc.doc.list.useQuery(
    { workspaceId: workspace?.id! },
    { enabled: !!workspace }
  )

  const channelIds = useMemo(() => channels?.map((c) => c.id) ?? [], [channels])
  const dmRoomIds = useMemo(() => dmRooms?.map((r) => r.id) ?? [], [dmRooms])
  const { unreadCounts } = useNotifications(channelIds, dmRoomIds)

  const totalUnread = useMemo(
    () => Object.values(unreadCounts).reduce((sum, n) => sum + n, 0),
    [unreadCounts]
  )

  const utils = trpc.useUtils()
  const createDoc = trpc.doc.create.useMutation({
    onSuccess: (doc) => {
      utils.doc.list.invalidate()
      router.push(`/workspace/docs/${doc.id}`)
    },
  })

  const handleCreateDoc = () => {
    if (!workspace || !currentUser) return
    createDoc.mutate({
      workspaceId: workspace.id,
      createdById: currentUser.id,
    })
  }

  const handleTabChange = (tab: Tab) => {
    if (tab === "chat") {
      if (channels && channels.length > 0) {
        router.push(`/workspace/channel/${channels[0].id}`)
      } else {
        router.push("/workspace")
      }
    } else if (tab === "tasks") {
      if (boards && boards.length > 0) {
        router.push(`/workspace/tasks/${boards[0].id}`)
      } else {
        router.push("/workspace/tasks")
      }
    } else if (tab === "docs") {
      if (docList && docList.length > 0) {
        router.push(`/workspace/docs/${docList[0].id}`)
      } else {
        router.push("/workspace/docs")
      }
    } else if (tab === "portals") {
      if (portalList && portalList.length > 0) {
        router.push(`/workspace/portals/${portalList[0].id}`)
      } else {
        router.push("/workspace/portals")
      }
    } else if (tab === "agent") {
      router.push("/workspace/agent")
    }
  }

  return (
    <div className="flex h-full flex-shrink-0">
      {/* Icon rail */}
      <NavRail
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onOpenSettings={() => setShowAgentSettings(true)}
        totalUnread={totalUnread}
        workspaceName={workspace?.name ?? "Staged"}
      />

      {/* Sidebar panel — hidden for agent tab */}
      {activeTab !== "agent" && (
        <div className="flex w-56 flex-col border-r bg-sidebar text-sidebar-foreground">
          {activeTab === "chat" ? (
            <ChatSidebar
              channels={channels}
              dmRooms={dmRooms}
              unreadCounts={unreadCounts}
              pathname={pathname}
              router={router}
              onCreateChannel={() => setShowCreateChannel(true)}
              onCreateDm={() => setShowCreateDm(true)}
            />
          ) : activeTab === "tasks" ? (
            <TasksSidebar
              boards={boards}
              pathname={pathname}
              router={router}
              onCreateBoard={() => setShowCreateBoard(true)}
            />
          ) : activeTab === "docs" ? (
            <DocsSidebar
              docs={docList}
              pathname={pathname}
              router={router}
              onCreateDoc={handleCreateDoc}
            />
          ) : (
            <PortalsSidebar
              portals={portalList}
              pathname={pathname}
              router={router}
              onCreatePortal={() => setShowCreatePortal(true)}
            />
          )}

          {/* User switcher at bottom */}
          <Separator />
          <UserSwitcher />
        </div>
      )}

      {/* Dialogs */}
      <ChannelCreateDialog
        open={showCreateChannel}
        onOpenChange={setShowCreateChannel}
        workspaceId={workspace?.id}
      />
      <DmCreateDialog
        open={showCreateDm}
        onOpenChange={setShowCreateDm}
        workspaceId={workspace?.id}
      />
      <BoardCreateDialog
        open={showCreateBoard}
        onOpenChange={setShowCreateBoard}
        workspaceId={workspace?.id}
      />
      <PortalCreateDialog
        open={showCreatePortal}
        onOpenChange={setShowCreatePortal}
        workspaceId={workspace?.id}
      />
      <AgentSettingsDialog
        open={showAgentSettings}
        onOpenChange={setShowAgentSettings}
      />
    </div>
  )
}
