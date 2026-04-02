import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { eq } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/server/db"
import { users } from "@/server/db/schema"
import { appRouter } from "@/server/trpc/router"
import { createContext } from "@/server/trpc/trpc"

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      const session = await getServerSession(authOptions)
      const email = session?.user?.email?.trim().toLowerCase()
      if (!email) return createContext(null)
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1)
      if (existing) {
        const nextName = session?.user?.name?.trim() || existing.name
        const nextAvatar = session?.user?.image?.trim() || existing.avatarUrl
        if (nextName !== existing.name || nextAvatar !== existing.avatarUrl) {
          await db
            .update(users)
            .set({
              name: nextName,
              avatarUrl: nextAvatar || null,
            })
            .where(eq(users.id, existing.id))
        }
        return createContext(existing.id)
      }

      const [created] = await db
        .insert(users)
        .values({
          email,
          name: session?.user?.name?.trim() || email.split("@")[0] || "User",
          avatarUrl: session?.user?.image?.trim() || null,
        })
        .returning()
        .catch(async () => {
          // Handle race where another request created the same user.
          const [raceWinner] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1)
          return raceWinner ? [raceWinner] : []
        })

      return createContext(created?.id ?? null)
    },
  })

export { handler as GET, handler as POST }
