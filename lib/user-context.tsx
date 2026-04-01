"use client"

import { createContext, useContext, useState, useCallback } from "react"
import { trpc } from "@/lib/trpc/client"

type User = {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}

type UserContextType = {
  currentUser: User | null
  users: User[]
  setCurrentUser: (user: User) => void
  isReady: boolean
}

const UserContext = createContext<UserContextType>({
  currentUser: null,
  users: [],
  setCurrentUser: () => {},
  isReady: false,
})

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { data: users } = trpc.user.list.useQuery()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const allUsers = users ?? []
  const currentUser =
    allUsers.find((u) => u.id === selectedId) ?? allUsers[0] ?? null
  const isReady = allUsers.length > 0

  const setCurrentUser = useCallback((user: User) => {
    setSelectedId(user.id)
  }, [])

  return (
    <UserContext.Provider
      value={{ currentUser, users: allUsers, setCurrentUser, isReady }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useCurrentUser() {
  return useContext(UserContext)
}
