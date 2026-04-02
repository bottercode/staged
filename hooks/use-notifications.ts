"use client"

import { useRef, useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { MESSAGE_POLL_QUERY_OPTIONS } from "@/lib/polling"

const NOTIFICATION_SOUND_URL = "https://cdn.freesound.org/previews/662/662411_11523868-lq.mp3"

export function useNotifications(
  channelIds: string[],
  dmRoomIds: string[]
) {
  const pathname = usePathname()
  const prevCounts = useRef<Record<string, number>>({})
  const seenCounts = useRef<Record<string, number>>({})
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const initialized = useRef(false)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})

  // Preload audio
  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND_URL)
    audioRef.current.volume = 0.5
  }, [])

  const { data: counts } = trpc.message.counts.useQuery(
    { channelIds, dmRoomIds },
    {
      enabled: channelIds.length > 0 || dmRoomIds.length > 0,
      ...MESSAGE_POLL_QUERY_OPTIONS,
    }
  )

  // Get which channel/dm is currently active from the URL
  const activeId = (pathname ?? "").match(
    /\/(channel|dm)\/([a-f0-9-]+)/
  )?.[2] ?? null

  // Mark the active channel/dm as "seen"
  useEffect(() => {
    if (activeId && counts?.[activeId] != null) {
      seenCounts.current[activeId] = counts[activeId]
    }
  }, [activeId, counts])

  // Detect new messages and play sound
  useEffect(() => {
    if (!counts) return

    // On first load, set baseline — don't notify for existing messages
    if (!initialized.current) {
      prevCounts.current = { ...counts }
      seenCounts.current = { ...counts }
      initialized.current = true
      return
    }

    let hasNew = false
    for (const [id, count] of Object.entries(counts)) {
      const prev = prevCounts.current[id] ?? 0
      if (count > prev && id !== activeId) {
        hasNew = true
      }
    }

    if (hasNew) {
      audioRef.current?.play().catch(() => {})
    }

    prevCounts.current = { ...counts }
  }, [counts, activeId])

  // Calculate unread counts (difference from last time user viewed)
  useEffect(() => {
    if (!counts) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnreadCounts({})
      return
    }

    const nextUnreadCounts: Record<string, number> = {}
    for (const [id, count] of Object.entries(counts)) {
      const seen = seenCounts.current[id] ?? 0
      const diff = count - seen
      if (diff > 0 && id !== activeId) {
        nextUnreadCounts[id] = diff
      }
    }
    setUnreadCounts(nextUnreadCounts)
  }, [counts, activeId])

  return { unreadCounts }
}
