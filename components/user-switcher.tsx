"use client"

import { ChevronDown } from "lucide-react"
import { signOut, useSession } from "next-auth/react"
import { useCurrentUser } from "@/lib/user-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"

export function UserSwitcher() {
  const { data: session } = useSession()
  const { currentUser } = useCurrentUser()

  const profileName = currentUser?.name || session?.user?.name
  const profileAvatar = currentUser?.avatarUrl || session?.user?.image || undefined
  const profileFallback = (profileName || "U")[0]

  if (!profileName) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2 px-4 py-3 text-sm transition-colors hover:bg-sidebar-accent/50">
          <Avatar className="h-7 w-7">
            <AvatarImage src={profileAvatar} />
            <AvatarFallback>{profileFallback}</AvatarFallback>
          </Avatar>
          <span className="flex-1 truncate text-left font-medium">
            {profileName}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        {session?.user?.email && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {session.user.email}
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          className="text-destructive focus:text-destructive"
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
