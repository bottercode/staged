import { eq } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/server/db"
import { users } from "@/server/db/schema"

export async function getAuthenticatedUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email?.trim().toLowerCase()
  if (!email) return null

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
  if (existing?.id) {
    const nextName = session?.user?.name?.trim()
    const nextAvatar = session?.user?.image?.trim()
    if (nextName || nextAvatar) {
      await db
        .update(users)
        .set({
          name: nextName || undefined,
          avatarUrl: nextAvatar || undefined,
        })
        .where(eq(users.id, existing.id))
    }
    return existing.id
  }

  const [created] = await db
    .insert(users)
    .values({
      email,
      name: session?.user?.name?.trim() || email.split("@")[0] || "User",
      avatarUrl: session?.user?.image?.trim() || null,
    })
    .returning({ id: users.id })
    .catch(async () => {
      const [raceWinner] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1)
      return raceWinner ? [raceWinner] : []
    })
  return created?.id ?? null
}
