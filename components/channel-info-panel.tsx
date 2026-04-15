"use client"

import { useMemo, useState } from "react"
import {
  Info,
  Pin,
  FileText,
  Link as LinkIcon,
  Lock,
  Hash,
  Calendar,
  Users as UsersIcon,
  X,
} from "lucide-react"
import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"

type Tab = "info" | "pins" | "files" | "links"

export function ChannelInfoPanel({
  channelId,
  onClose,
}: {
  channelId: string
  onClose: () => void
}) {
  const [tab, setTab] = useState<Tab>("info")
  const { data: channel } = trpc.channel.getById.useQuery({ id: channelId })
  const { data: members } = trpc.channel.getMembers.useQuery({ channelId })
  const { data: messages } = trpc.message.list.useQuery({ channelId })

  const messageCount = messages?.length ?? 0
  const createdAt = channel?.createdAt ? new Date(channel.createdAt) : null
  const formattedDate = createdAt
    ? createdAt.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—"

  const activity = useMemo(() => {
    const days: number[] = Array(84).fill(0)
    if (!messages) return days
    const now = Date.now()
    const DAY = 24 * 60 * 60 * 1000
    for (const m of messages) {
      const d = new Date(m.createdAt).getTime()
      const daysAgo = Math.floor((now - d) / DAY)
      if (daysAgo >= 0 && daysAgo < 84) {
        days[83 - daysAgo] += 1
      }
    }
    return days
  }, [messages])

  const maxActivity = Math.max(1, ...activity)

  const tabs: Array<{ id: Tab; label: string; icon: typeof Info }> = [
    { id: "info", label: "Info", icon: Info },
    { id: "pins", label: "Pins", icon: Pin },
    { id: "files", label: "Files", icon: FileText },
    { id: "links", label: "Links", icon: LinkIcon },
  ]

  return (
    <div className="flex h-full w-[260px] flex-shrink-0 flex-col border-l border-border/60 bg-background xl:w-[320px]">
      <div className="flex h-14 items-center gap-1 border-b border-border/60 px-2">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = tab === id
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium transition-all",
                isActive
                  ? "bg-muted/70 text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          )
        })}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0 text-muted-foreground"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {tab === "info" && (
          <div className="space-y-5 p-4">
            {/* Main info */}
            <section>
              <h3 className="mb-2 px-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/80 uppercase">
                Main Info
              </h3>
              <div className="rounded-xl border border-border/60 bg-card">
                <InfoRow
                  label="Channel"
                  value={channel?.name ?? "—"}
                  icon={channel?.isPrivate ? Lock : Hash}
                />
                <InfoRow
                  label="Date of creation"
                  value={formattedDate}
                  icon={Calendar}
                />
                <InfoRow
                  label="Visibility"
                  value={
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                        channel?.isPrivate
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      )}
                    >
                      {channel?.isPrivate ? "Private" : "Public"}
                    </span>
                  }
                />
                <InfoRow label="Messages" value={String(messageCount)} last />
              </div>
            </section>

            {/* About */}
            <section>
              <h3 className="mb-2 px-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/80 uppercase">
                About
              </h3>
              <div className="rounded-xl border border-border/60 bg-card p-3.5">
                <p className="text-[11px] font-medium text-muted-foreground">
                  Description
                </p>
                <p className="mt-1 text-[13px] text-foreground">
                  {channel?.description?.trim() || "No description yet"}
                </p>
                <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
                  <UsersIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">
                    Members
                  </span>
                  <span className="ml-auto text-[13px] font-semibold tabular-nums">
                    {members?.length ?? 0}
                  </span>
                </div>
              </div>
            </section>

            {/* Activity */}
            <section>
              <h3 className="mb-2 px-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/80 uppercase">
                Channel Activity
              </h3>
              <div className="rounded-xl border border-border/60 bg-card p-3.5">
                <div className="grid grid-cols-12 gap-[3px]">
                  {activity.map((count, i) => {
                    const intensity = count / maxActivity
                    const bg =
                      count === 0
                        ? "bg-muted/60"
                        : intensity > 0.66
                          ? "bg-primary"
                          : intensity > 0.33
                            ? "bg-primary/60"
                            : "bg-primary/30"
                    return (
                      <div
                        key={i}
                        className={cn("aspect-square rounded-[3px]", bg)}
                        title={`${count} messages`}
                      />
                    )
                  })}
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Last 84 days
                </p>
              </div>
            </section>

            {/* Members */}
            <section>
              <div className="mb-2 flex items-center justify-between px-1">
                <h3 className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/80 uppercase">
                  Members
                </h3>
                <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                  {members?.length ?? 0}
                </span>
              </div>
              <div className="space-y-1">
                {(members ?? []).slice(0, 20).map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50"
                  >
                    <Avatar className="h-7 w-7 ring-1 ring-border/60">
                      <AvatarImage src={m.avatarUrl ?? undefined} />
                      <AvatarFallback className="text-[10px]">
                        {m.name?.[0]?.toUpperCase() ?? "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">
                        {m.name}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {m.email}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === "pins" && <PinsTab channelId={channelId} />}
        {tab === "files" && <FilesTab channelId={channelId} />}
        {tab === "links" && <LinksTab channelId={channelId} />}
      </ScrollArea>
    </div>
  )
}

function InfoRow({
  label,
  value,
  icon: Icon,
  last,
}: {
  label: string
  value: React.ReactNode
  icon?: typeof Info
  last?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3.5 py-2.5",
        !last && "border-b border-border/60"
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 text-muted-foreground" /> : null}
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div className="ml-auto text-[13px] font-medium text-foreground">
        {value}
      </div>
    </div>
  )
}

function EmptyTab({ icon: Icon, label }: { icon: typeof Info; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-[13px] text-muted-foreground">{label}</p>
    </div>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatRelativeDate(date: Date | string | null) {
  if (!date) return ""
  const d = new Date(date)
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  })
}

function PinsTab({ channelId }: { channelId: string }) {
  const { data: pins, isLoading } = trpc.message.listPinned.useQuery({
    channelId,
  })
  if (isLoading) return null
  if (!pins || pins.length === 0)
    return <EmptyTab icon={Pin} label="No pinned messages" />
  return (
    <div className="space-y-2 p-4">
      {pins.map((pin) => (
        <div
          key={pin.id}
          className="rounded-xl border border-border/60 bg-card p-3"
        >
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6 ring-1 ring-border/60">
              <AvatarImage src={pin.userAvatar ?? undefined} />
              <AvatarFallback className="text-[9px]">
                {pin.userName?.[0]?.toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
            <span className="text-[12px] font-semibold">{pin.userName}</span>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {formatRelativeDate(pin.pinnedAt ?? pin.createdAt)}
            </span>
          </div>
          {pin.content && (
            <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-foreground">
              {pin.content}
            </p>
          )}
          {(pin.attachments ?? []).length > 0 && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {pin.attachments.length} attachment
              {pin.attachments.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

function FilesTab({ channelId }: { channelId: string }) {
  const { data: files, isLoading } = trpc.message.listFiles.useQuery({
    channelId,
  })
  if (isLoading) return null
  if (!files || files.length === 0)
    return <EmptyTab icon={FileText} label="No shared files yet" />
  return (
    <div className="space-y-2 p-4">
      {files.map((file, i) => {
        const isImage = file.contentType?.startsWith("image/")
        return (
          <a
            key={`${file.messageId}-${i}`}
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 transition-colors hover:bg-muted/40"
          >
            {isImage ? (
              <img
                src={file.url}
                alt={file.name}
                className="h-10 w-10 flex-shrink-0 rounded-md border object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-muted/60">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{file.name}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {formatBytes(file.size)} · {file.userName} ·{" "}
                {formatRelativeDate(file.createdAt)}
              </p>
            </div>
          </a>
        )
      })}
    </div>
  )
}

function LinksTab({ channelId }: { channelId: string }) {
  const { data: links, isLoading } = trpc.message.listLinks.useQuery({
    channelId,
  })
  if (isLoading) return null
  if (!links || links.length === 0)
    return <EmptyTab icon={LinkIcon} label="No shared links yet" />
  return (
    <div className="space-y-2 p-4">
      {links.map((link, i) => {
        let host = link.url
        try {
          host = new URL(link.url).host
        } catch {}
        return (
          <a
            key={`${link.messageId}-${i}`}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl border border-border/60 bg-card p-3 transition-colors hover:bg-muted/40"
          >
            <div className="flex items-center gap-2">
              <LinkIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              <span className="truncate text-[12px] font-semibold text-foreground">
                {host}
              </span>
              <span className="ml-auto flex-shrink-0 text-[10px] text-muted-foreground">
                {formatRelativeDate(link.createdAt)}
              </span>
            </div>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              {link.url}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Shared by {link.userName}
            </p>
          </a>
        )
      })}
    </div>
  )
}
