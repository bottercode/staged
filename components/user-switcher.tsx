"use client"

import { ChevronDown } from "lucide-react"
import { useCurrentUser } from "@/lib/user-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function UserSwitcher() {
  const { currentUser, users, setCurrentUser } = useCurrentUser()

  if (!currentUser) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2 px-4 py-3 text-sm transition-colors hover:bg-sidebar-accent/50">
          <Avatar className="h-7 w-7">
            <AvatarImage src={currentUser.avatarUrl ?? undefined} />
            <AvatarFallback>{currentUser.name[0]}</AvatarFallback>
          </Avatar>
          <span className="flex-1 truncate text-left font-medium">
            {currentUser.name}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        {users.map((user) => (
          <DropdownMenuItem
            key={user.id}
            onClick={() => setCurrentUser(user)}
            className="flex items-center gap-2"
          >
            <Avatar className="h-5 w-5">
              <AvatarImage src={user.avatarUrl ?? undefined} />
              <AvatarFallback>{user.name[0]}</AvatarFallback>
            </Avatar>
            <span>{user.name}</span>
            {user.id === currentUser.id && (
              <span className="ml-auto text-xs text-muted-foreground">
                (you)
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
