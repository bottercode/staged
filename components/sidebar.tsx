"use client"

import {
  Hash,
  Lock,
  Plus,
  SquareKanban,
  MessageCircle,
  Building2,
  BookOpen,
  Sparkles,
  Settings2,
  Check,
  MoreHorizontal,
  Pencil,
  Trash2,
  LayoutGrid,
  Globe,
} from "lucide-react"
import { useRouter, usePathname } from "next/navigation"
import { skipToken } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { useCurrentUser } from "@/lib/user-context"
import { useNotifications } from "@/hooks/use-notifications"
import {
  readSelectedWorkspaceId,
  writeSelectedWorkspaceId,
} from "@/lib/workspace-selection"
import { UserSwitcher } from "./user-switcher"
import { ChannelCreateDialog } from "./channel-create-dialog"
import { DmCreateDialog } from "./dm-create-dialog"
import { BoardCreateDialog } from "./tasks/board-create-dialog"
import { PortalCreateDialog } from "./portal-create-dialog"
import { AgentSettingsDialog } from "./agent-settings-dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type Tab = "chat" | "tasks" | "portals" | "docs" | "agent"
const AGENT_OPEN_SETTINGS_REQUEST_KEY = "staged-agent-open-settings-request"

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
  onCreateWorkspace,
  workspaces,
  activeWorkspaceId,
  onSwitchWorkspace,
  totalUnread,
  workspaceName,
}: {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  onOpenSettings: () => void
  onCreateWorkspace: () => void
  workspaces: Array<{ id: string; name: string }>
  activeWorkspaceId?: string
  onSwitchWorkspace: (workspaceId: string) => void
  totalUnread: number
  workspaceName: string
}) {
  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex w-12 flex-shrink-0 flex-col items-center gap-1 border-r bg-sidebar py-3">
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90">
                  {workspaceName[0]?.toUpperCase() ?? "S"}
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">{workspaceName}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent side="right" align="start" className="w-48">
            {workspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => onSwitchWorkspace(workspace.id)}
                className="cursor-pointer"
              >
                <span className="truncate">{workspace.name}</span>
                {workspace.id === activeWorkspaceId ? (
                  <Check className="ml-auto h-3.5 w-3.5" />
                ) : null}
              </DropdownMenuItem>
            ))}
            {workspaces.length > 0 ? <Separator className="my-1" /> : null}
            <DropdownMenuItem
              onClick={onCreateWorkspace}
              className="cursor-pointer"
            >
              Create New Workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
              <MessageCircle className="h-4.5 w-4.5" />
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
              <SquareKanban className="h-4.5 w-4.5" />
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
              <BookOpen className="h-4.5 w-4.5" />
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
              <Building2 className="h-4.5 w-4.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Client Portals</TooltipContent>
        </Tooltip>

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
              <Sparkles className="h-4.5 w-4.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">AI Agent</TooltipContent>
        </Tooltip>

        <div className="mt-auto" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onOpenSettings}
              data-settings-trigger="workspace"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <Settings2 className="h-4.5 w-4.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Workspace Settings</TooltipContent>
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
  channels: { id: string; name: string; isPrivate: boolean }[] | undefined
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
  const utils = trpc.useUtils()
  return (
    <>
      <div className="flex h-12 items-center gap-2 border-b px-4">
        <span className="text-sm font-semibold">Chat</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
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
                onMouseEnter={() =>
                  utils.message.list.prefetch({ channelId: channel.id })
                }
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
                {channel.isPrivate ? (
                  <Lock className="h-3.5 w-3.5 flex-shrink-0" />
                ) : (
                  <Hash className="h-3.5 w-3.5 flex-shrink-0" />
                )}
                <span className="truncate">{channel.name}</span>
                <UnreadBadge count={unread} />
              </button>
            )
          })}

          <Separator className="my-3" />

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
            const fallback =
              (otherUser?.name || "U").trim()[0]?.toUpperCase() || "U"
            return (
              <button
                key={room.id}
                onMouseEnter={() =>
                  utils.dm.messages.prefetch({ roomId: room.id })
                }
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
                <Avatar className="h-4.5 w-4.5 flex-shrink-0">
                  <AvatarImage src={otherUser?.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-[9px]">
                    {fallback}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-left">
                  {otherUser?.name ?? "Unknown"}
                </span>
                {unread > 0 ? <UnreadBadge count={unread} /> : null}
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
  onRenameBoard,
  onDeleteBoard,
}: {
  boards: { id: string; name: string }[] | undefined
  pathname: string
  router: ReturnType<typeof useRouter>
  onCreateBoard: () => void
  onRenameBoard: (board: { id: string; name: string }) => void
  onDeleteBoard: (board: { id: string; name: string }) => void
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
              <div
                key={board.id}
                className={cn(
                  "group flex items-center gap-1 rounded-md pr-1",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/50"
                )}
              >
                <button
                  onClick={() => router.push(`/workspace/tasks/${board.id}`)}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-sm transition-colors",
                    isActive
                      ? "font-medium text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70"
                  )}
                >
                  <LayoutGrid className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{board.name}</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                        isActive
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100"
                      )}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="right"
                    align="start"
                    className="w-40"
                  >
                    <DropdownMenuItem
                      onClick={() => onRenameBoard(board)}
                      className="cursor-pointer"
                    >
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDeleteBoard(board)}
                      className="cursor-pointer text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
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
                <span className="min-w-0 flex-1 truncate text-left">
                  {doc.title || "Untitled"}
                </span>
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
  const pathname = usePathname() || ""
  const { currentUser } = useCurrentUser()

  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [showCreateDm, setShowCreateDm] = useState(false)
  const [showCreateBoard, setShowCreateBoard] = useState(false)
  const [showCreatePortal, setShowCreatePortal] = useState(false)
  const [showAgentSettings, setShowAgentSettings] = useState(false)
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false)
  const [renameBoardTarget, setRenameBoardTarget] = useState<{
    id: string
    name: string
  } | null>(null)
  const [deleteBoardTarget, setDeleteBoardTarget] = useState<{
    id: string
    name: string
  } | null>(null)
  const [boardRenameValue, setBoardRenameValue] = useState("")
  const [newWorkspaceName, setNewWorkspaceName] = useState("")
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null
  )
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedWorkspaceId(readSelectedWorkspaceId())
  }, [])

  const activeTab: Tab = pathname.includes("/agent")
    ? "agent"
    : pathname.includes("/portals")
      ? "portals"
      : pathname.includes("/docs")
        ? "docs"
        : pathname.includes("/tasks")
          ? "tasks"
          : "chat"

  const { data: workspace } = trpc.workspace.getDefault.useQuery(
    selectedWorkspaceId
      ? { preferredWorkspaceId: selectedWorkspaceId }
      : undefined
  )
  const { data: workspaces } = trpc.workspace.list.useQuery()
  const uniqueWorkspaces = (() => {
    const map = new Map<string, { id: string; name: string }>()
    for (const workspace of workspaces ?? []) {
      if (!map.has(workspace.id)) {
        map.set(workspace.id, { id: workspace.id, name: workspace.name })
      }
    }
    if (workspace?.id && !map.has(workspace.id)) {
      map.set(workspace.id, {
        id: workspace.id,
        name: workspace.name,
      })
    }
    return Array.from(map.values())
  })()
  const { data: channels } = trpc.channel.list.useQuery(
    workspace ? { workspaceId: workspace.id } : skipToken
  )
  const { data: dmRooms } = trpc.dm.list.useQuery(
    workspace && currentUser
      ? { workspaceId: workspace.id, userId: currentUser.id }
      : skipToken
  )
  const { data: boards } = trpc.board.list.useQuery(
    workspace ? { workspaceId: workspace.id } : skipToken
  )
  const { data: portalList } = trpc.portal.list.useQuery(
    workspace ? { workspaceId: workspace.id } : skipToken
  )
  const { data: docList } = trpc.doc.list.useQuery(
    workspace ? { workspaceId: workspace.id } : skipToken
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
    onSuccess: async (doc) => {
      await utils.doc.list.invalidate()
      router.push(`/workspace/docs/${doc.id}`)
    },
  })

  const createWorkspace = trpc.workspace.create.useMutation({
    onSuccess: async (createdWorkspace) => {
      await Promise.all([
        utils.workspace.getDefault.invalidate(),
        utils.channel.list.invalidate(),
      ])
      const workspaceChannels = await utils.channel.list.fetch({
        workspaceId: createdWorkspace.id,
      })
      const first = workspaceChannels?.[0]
      writeSelectedWorkspaceId(createdWorkspace.id)
      setSelectedWorkspaceId(createdWorkspace.id)
      setShowCreateWorkspace(false)
      setNewWorkspaceName("")
      if (first) {
        router.push(`/workspace/channel/${first.id}`)
      } else {
        router.push("/workspace")
      }
    },
  })

  const renameBoard = trpc.board.rename.useMutation({
    onSuccess: async (updatedBoard) => {
      await Promise.all([
        utils.board.list.invalidate(),
        utils.board.getById.invalidate(),
      ])
      if (updatedBoard?.id) {
        router.push(`/workspace/tasks/${updatedBoard.id}`)
      }
      setRenameBoardTarget(null)
      setBoardRenameValue("")
    },
  })

  const deleteBoard = trpc.board.delete.useMutation({
    onSuccess: async (result) => {
      await Promise.all([
        utils.board.list.invalidate(),
        utils.board.getById.invalidate(),
      ])
      const remainingBoards =
        boards?.filter((board) => board.id !== result.id) ?? []
      if (pathname.includes(`/tasks/${result.id}`)) {
        if (remainingBoards.length > 0) {
          router.push(`/workspace/tasks/${remainingBoards[0].id}`)
        } else {
          router.push("/workspace/tasks")
        }
      }
      setDeleteBoardTarget(null)
    },
  })

  useEffect(() => {
    if (!workspace?.id) return
    if (!selectedWorkspaceId) {
      writeSelectedWorkspaceId(workspace.id)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedWorkspaceId(workspace.id)
    }
  }, [workspace?.id, selectedWorkspaceId])

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

  const handleOpenSettings = () => {
    if (activeTab === "agent" && typeof window !== "undefined") {
      window.localStorage.setItem(
        AGENT_OPEN_SETTINGS_REQUEST_KEY,
        String(Date.now())
      )
    }
    setShowAgentSettings(true)
  }

  return (
    <div className="flex h-full flex-shrink-0">
      <NavRail
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onOpenSettings={handleOpenSettings}
        onCreateWorkspace={() => setShowCreateWorkspace(true)}
        workspaces={uniqueWorkspaces}
        activeWorkspaceId={workspace?.id}
        onSwitchWorkspace={(workspaceId) => {
          writeSelectedWorkspaceId(workspaceId)
          setSelectedWorkspaceId(workspaceId)
          utils.workspace.getDefault.invalidate()
          utils.channel.list.invalidate()
          router.push("/workspace")
        }}
        totalUnread={totalUnread}
        workspaceName={workspace?.name ?? "Staged"}
      />

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
              onRenameBoard={(board) => {
                setRenameBoardTarget(board)
                setBoardRenameValue(board.name)
              }}
              onDeleteBoard={(board) => setDeleteBoardTarget(board)}
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

          <Separator />
          <UserSwitcher />
        </div>
      )}

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
        workspaceId={workspace?.id}
        workspaceName={workspace?.name}
        workspaceCreatedAt={workspace?.createdAt}
        currentUserId={currentUser?.id}
      />

      <Dialog open={showCreateWorkspace} onOpenChange={setShowCreateWorkspace}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Workspace Name</p>
            <Input
              value={newWorkspaceName}
              placeholder="My Workspace"
              onChange={(event) => setNewWorkspaceName(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateWorkspace(false)
                setNewWorkspaceName("")
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!newWorkspaceName.trim() || createWorkspace.isPending}
              onClick={() => {
                if (!newWorkspaceName.trim()) return
                createWorkspace.mutate({
                  name: newWorkspaceName.trim(),
                })
              }}
            >
              {createWorkspace.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(renameBoardTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRenameBoardTarget(null)
            setBoardRenameValue("")
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename board</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!renameBoardTarget || !boardRenameValue.trim()) return
              renameBoard.mutate({
                id: renameBoardTarget.id,
                name: boardRenameValue.trim(),
              })
            }}
          >
            <Input
              value={boardRenameValue}
              onChange={(e) => setBoardRenameValue(e.target.value)}
              placeholder="Board name"
              autoFocus
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRenameBoardTarget(null)
                  setBoardRenameValue("")
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!boardRenameValue.trim() || renameBoard.isPending}
              >
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteBoardTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteBoardTarget(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete board?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete{" "}
            <strong>{deleteBoardTarget?.name}</strong> and all its tasks.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteBoardTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!deleteBoardTarget || deleteBoard.isPending}
              onClick={() => {
                if (!deleteBoardTarget) return
                deleteBoard.mutate({ id: deleteBoardTarget.id })
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
