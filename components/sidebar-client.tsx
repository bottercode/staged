"use client"

import dynamic from "next/dynamic"

export const SidebarClient = dynamic(
  () => import("@/components/sidebar").then((m) => ({ default: m.Sidebar })),
  { ssr: false }
)
