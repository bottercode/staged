"use client"

// Persist the desktop-client marker as soon as the sidebar module loads on
// the client. The Electron webview initially navigates to
// `/workspace?client=desktop`; SPA navigations afterwards drop the query
// string, so we stash it in sessionStorage for later checks.
if (typeof window !== "undefined") {
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get("client") === "desktop") {
      window.sessionStorage.setItem("staged-client", "desktop")
    }
  } catch {
    // ignore
  }
}

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
  MoreHorizontal,
  Pencil,
  Trash2,
  LayoutGrid,
  Globe,
  Sun,
  Moon,
  Monitor,
  LogOut,
} from "lucide-react"
import { signOut } from "next-auth/react"
import { useTheme } from "next-themes"
import {
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
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
import { useSession } from "next-auth/react"
import { ChannelCreateDialog } from "./channel-create-dialog"
import { DmCreateDialog } from "./dm-create-dialog"
import { BoardCreateDialog } from "./tasks/board-create-dialog"
import { PortalCreateDialog } from "./portal-create-dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
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

type Tab = "chat" | "tasks" | "portals" | "docs" | "agent" | "settings"
const AGENT_OPEN_SETTINGS_REQUEST_KEY = "staged-agent-open-settings-request"

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground tabular-nums">
      {count > 99 ? "99+" : count}
    </span>
  )
}

function OrgRail({
  workspaces,
  activeWorkspaceId,
  onSwitchWorkspace,
  onCreateWorkspace,
}: {
  workspaces: Array<{ id: string; name: string }>
  activeWorkspaceId?: string
  onSwitchWorkspace: (workspaceId: string) => void
  onCreateWorkspace: () => void
}) {
  const { data: session } = useSession()
  const { currentUser } = useCurrentUser()
  const { theme, setTheme } = useTheme()
  const profileName = currentUser?.name || session?.user?.name || "You"
  const profileAvatar =
    currentUser?.avatarUrl || session?.user?.image || undefined
  const profileFallback = (profileName || "U")[0]?.toUpperCase() ?? "U"

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-full w-14 flex-shrink-0 flex-col items-center gap-2 bg-background py-3">
        <div className="flex flex-1 flex-col items-center gap-2">
          {workspaces.map((workspace) => {
            const isActive = workspace.id === activeWorkspaceId
            return (
              <Tooltip key={workspace.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onSwitchWorkspace(workspace.id)}
                    className={cn(
                      "group relative flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-semibold transition-all",
                      isActive
                        ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md ring-1 ring-primary/30"
                        : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground hover:shadow-sm"
                    )}
                  >
                    {workspace.name[0]?.toUpperCase() ?? "W"}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{workspace.name}</TooltipContent>
              </Tooltip>
            )
          })}

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onCreateWorkspace}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/30 text-muted-foreground transition-all hover:border-border hover:bg-muted/60 hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Create workspace</TooltipContent>
          </Tooltip>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex flex-col items-center gap-1 pb-1 outline-none">
              <span className="text-[9px] font-medium text-muted-foreground/70">
                Account
              </span>
              <Avatar className="h-8 w-8 ring-1 ring-border/60 transition-all hover:ring-primary/40">
                <AvatarImage src={profileAvatar} />
                <AvatarFallback className="text-[10px]">
                  {profileFallback}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-56">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Avatar className="h-7 w-7">
                <AvatarImage src={profileAvatar} />
                <AvatarFallback className="text-[10px]">
                  {profileFallback}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">
                  {profileName}
                </p>
                {session?.user?.email && (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {session.user.email}
                  </p>
                )}
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer">
                {theme === "dark" ? (
                  <Moon className="mr-2 h-3.5 w-3.5" />
                ) : theme === "light" ? (
                  <Sun className="mr-2 h-3.5 w-3.5" />
                ) : (
                  <Monitor className="mr-2 h-3.5 w-3.5" />
                )}
                Theme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  onClick={() => setTheme("light")}
                  className="cursor-pointer"
                >
                  <Sun className="mr-2 h-3.5 w-3.5" />
                  Light
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme("dark")}
                  className="cursor-pointer"
                >
                  <Moon className="mr-2 h-3.5 w-3.5" />
                  Dark
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme("system")}
                  className="cursor-pointer"
                >
                  <Monitor className="mr-2 h-3.5 w-3.5" />
                  System
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/auth/signin" })}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  )
}

function NavRail({
  activeTab,
  onTabChange,
  totalUnread,
  onOpenSettings,
}: {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  totalUnread: number
  onOpenSettings: () => void
}) {
  const navItems: Array<{
    tab: Tab
    icon: React.ComponentType<{ className?: string }>
    label: string
  }> = [
    { tab: "chat", icon: MessageCircle, label: "Chat" },
    { tab: "tasks", icon: SquareKanban, label: "Tasks" },
    { tab: "docs", icon: BookOpen, label: "Docs" },
    { tab: "portals", icon: Building2, label: "Client Portals" },
    { tab: "agent", icon: Sparkles, label: "AI Agent" },
  ]

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex w-14 flex-shrink-0 flex-col items-center gap-1.5 border-r border-sidebar-border/60 bg-sidebar py-3">
        {navItems.map(({ tab, icon: Icon, label }) => {
          const isActive = activeTab === tab
          const showBadge =
            tab === "chat" && totalUnread > 0 && activeTab !== "chat"
          return (
            <Tooltip key={tab}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onTabChange(tab)}
                  className={cn(
                    "group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150",
                    isActive
                      ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/15"
                      : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "absolute left-0 h-5 w-0.5 rounded-r-full bg-primary transition-all duration-200",
                      isActive
                        ? "opacity-100"
                        : "opacity-0 group-hover:h-3 group-hover:opacity-40"
                    )}
                  />
                  <Icon className="h-[18px] w-[18px]" />
                  {showBadge && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white ring-2 ring-sidebar">
                      {totalUnread > 9 ? "9+" : totalUnread}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          )
        })}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onOpenSettings}
              className="group relative flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-all duration-150 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
            >
              <Settings2 className="h-[18px] w-[18px]" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>

        <div className="mt-auto" />
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
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border/60 px-4">
        <span className="text-[15px] font-semibold tracking-tight">Chat</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-5 p-3">
          <div>
            <div className="mb-1.5 flex items-center justify-between px-2">
              <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/80 uppercase">
                Channels
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                onClick={onCreateChannel}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="space-y-0.5">
              {channels?.map((channel) => {
                const isActive = pathname.includes(`/channel/${channel.id}`)
                const unread = unreadCounts[channel.id] ?? 0
                return (
                  <button
                    key={channel.id}
                    onMouseEnter={() =>
                      utils.message.list.prefetch({ channelId: channel.id })
                    }
                    onClick={() =>
                      router.push(`/workspace/channel/${channel.id}`)
                    }
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-all duration-150",
                      isActive
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-sm"
                        : unread > 0
                          ? "font-semibold text-sidebar-foreground hover:bg-sidebar-accent/60"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                    )}
                  >
                    {channel.isPrivate ? (
                      <Lock className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
                    ) : (
                      <Hash className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
                    )}
                    <span className="truncate">{channel.name}</span>
                    <UnreadBadge count={unread} />
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between px-2">
              <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/80 uppercase">
                Direct Messages
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                onClick={onCreateDm}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="space-y-0.5">
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
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-all duration-150",
                      isActive
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-sm"
                        : unread > 0
                          ? "font-semibold text-sidebar-foreground hover:bg-sidebar-accent/60"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                    )}
                  >
                    <Avatar className="h-5 w-5 flex-shrink-0 ring-1 ring-sidebar-border/60">
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
          </div>
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
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border/60 px-4">
        <span className="text-[15px] font-semibold tracking-tight">Tasks</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3">
          <div className="mb-1.5 flex items-center justify-between px-2">
            <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/80 uppercase">
              Boards
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
              onClick={onCreateBoard}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="space-y-0.5">
            {boards?.map((board) => {
              const isActive = pathname.includes(`/tasks/${board.id}`)
              return (
                <div
                  key={board.id}
                  className={cn(
                    "group flex items-center gap-1 rounded-lg pr-1 transition-all duration-150",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "hover:bg-sidebar-accent/60"
                  )}
                >
                  <button
                    onClick={() => router.push(`/workspace/tasks/${board.id}`)}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-1.5 text-[13px] transition-colors",
                      isActive
                        ? "font-medium text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 group-hover:text-sidebar-foreground"
                    )}
                  >
                    <LayoutGrid className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
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
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border/60 px-4">
        <span className="text-[15px] font-semibold tracking-tight">
          Client Portals
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3">
          <div className="mb-1.5 flex items-center justify-between px-2">
            <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/80 uppercase">
              Portals
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
              onClick={onCreatePortal}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="space-y-0.5">
            {portals?.map((portal) => {
              const isActive = pathname.includes(`/portals/${portal.id}`)
              return (
                <button
                  key={portal.id}
                  onClick={() => router.push(`/workspace/portals/${portal.id}`)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-all duration-150",
                    isActive
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  )}
                >
                  <Globe className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
                  <div className="min-w-0 flex-1 text-left">
                    <span className="block truncate">{portal.name}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {portal.clientName}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

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
  docs:
    | {
        id: string
        parentId: string | null
        title: string
        emoji: string | null
        updatedAt: Date
      }[]
    | undefined
  pathname: string
  router: ReturnType<typeof useRouter>
  onCreateDoc: () => void
}) {
  const formatShortDate = (date: Date) => {
    const d = new Date(date)
    return d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
    })
  }

  const childrenByParent = useMemo(() => {
    const map = new Map<string, typeof docs>()
    for (const d of docs ?? []) {
      if (!d.parentId) continue
      const arr = map.get(d.parentId) ?? []
      arr.push(d)
      map.set(d.parentId, arr)
    }
    return map
  }, [docs])

  const rootDocs = (docs ?? []).filter((d) => !d.parentId)

  return (
    <>
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border/60 px-4">
        <span className="text-[17px] font-bold tracking-tight">My Notes</span>
      </div>

      <div className="px-3 pt-3">
        <Button
          onClick={onCreateDoc}
          variant="outline"
          className="h-9 w-full justify-center rounded-lg border-dashed text-[13px] font-medium text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add new note
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-1 px-3 py-3">
          {rootDocs.map((doc) => {
            const isActive = pathname.includes(`/docs/${doc.id}`)
            const children = childrenByParent.get(doc.id) ?? []
            return (
              <div key={doc.id} className="space-y-0.5">
                <button
                  onClick={() => router.push(`/workspace/docs/${doc.id}`)}
                  className={cn(
                    "w-full rounded-xl border px-3 py-2.5 text-left transition-all",
                    isActive
                      ? "border-border bg-sidebar-accent shadow-sm"
                      : "border-transparent hover:border-border/60 hover:bg-sidebar-accent/40"
                  )}
                >
                  <div className="mb-1 text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                    {formatShortDate(doc.updatedAt)}
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="mt-0.5 text-[13px] leading-none">
                      {doc.emoji || "📄"}
                    </span>
                    <span className="line-clamp-2 flex-1 text-[13px] font-semibold tracking-tight text-sidebar-foreground">
                      {doc.title || "Untitled"}
                    </span>
                  </div>
                </button>
                {children.length > 0 && (
                  <div className="ml-4 space-y-0.5 border-l border-border/50 pl-2">
                    {children.map((child) => {
                      const childActive = pathname.includes(`/docs/${child.id}`)
                      return (
                        <button
                          key={child.id}
                          onClick={() =>
                            router.push(`/workspace/docs/${child.id}`)
                          }
                          className={cn(
                            "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[12px] transition-colors",
                            childActive
                              ? "bg-sidebar-accent font-medium text-foreground"
                              : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                          )}
                        >
                          <span className="text-[11px] leading-none">
                            {child.emoji || "📄"}
                          </span>
                          <span className="truncate">
                            {child.title || "Untitled"}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {rootDocs.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No notes yet
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

  const activeTab: Tab = pathname.includes("/settings")
    ? "settings"
    : pathname.includes("/agent")
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
    router.push("/workspace/settings")
  }

  return (
    <div className="flex h-full flex-shrink-0 gap-2">
      <OrgRail
        workspaces={uniqueWorkspaces}
        activeWorkspaceId={workspace?.id}
        onSwitchWorkspace={(workspaceId) => {
          writeSelectedWorkspaceId(workspaceId)
          setSelectedWorkspaceId(workspaceId)
          utils.workspace.getDefault.invalidate()
          utils.channel.list.invalidate()
          router.push("/workspace")
        }}
        onCreateWorkspace={() => setShowCreateWorkspace(true)}
      />

      <div className="flex flex-1 overflow-hidden rounded-2xl border border-border/60 bg-sidebar shadow-sm">
        <NavRail
          activeTab={activeTab}
          onTabChange={handleTabChange}
          totalUnread={totalUnread}
          onOpenSettings={handleOpenSettings}
        />

        {activeTab !== "agent" && activeTab !== "settings" && (
          <div className="flex w-52 flex-col border-l border-sidebar-border/60 bg-sidebar text-sidebar-foreground xl:w-60">
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
          </div>
        )}
      </div>

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
