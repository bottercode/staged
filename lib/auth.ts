import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { eq } from "drizzle-orm"
import { db } from "@/server/db"
import { users } from "@/server/db/schema"

const googleClientId = process.env.AUTH_GOOGLE_ID
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET

export const authOptions: NextAuthOptions = {
  providers:
    googleClientId && googleClientSecret
      ? [
          GoogleProvider({
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          }),
        ]
      : [],
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.trim().toLowerCase()
      if (!email) return false

      const name = user.name?.trim() || email.split("@")[0] || "User"
      const avatarUrl = user.image?.trim() || null

      const [existing] = await db
        .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.email, email))
        .limit(1)

      if (existing) {
        if (existing.name !== name || (existing.avatarUrl || null) !== avatarUrl) {
          await db
            .update(users)
            .set({
              name,
              avatarUrl,
            })
            .where(eq(users.id, existing.id))
        }
        return true
      }

      await db
        .insert(users)
        .values({
          email,
          name,
          avatarUrl,
        })
        .catch(() => {})

      return true
    },
  },
  session: {
    strategy: "jwt",
  },
}
