import { redirect } from "next/navigation"
import { and, eq } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/server/db"
import {
  channels,
  channelMembers,
  users,
  workspaceInviteLinks,
  workspaceMembers,
} from "@/server/db/schema"

export default async function JoinWorkspacePage({
  params,
}: {
  params: Promise<{ token: string }> | { token: string }
}) {
  const resolvedParams =
    typeof (params as Promise<{ token: string }>).then === "function"
      ? await (params as Promise<{ token: string }>)
      : (params as { token: string })
  const token = resolvedParams.token?.trim()

  if (!token) {
    redirect("/auth/signin")
  }

  const [inviteLink] = await db
    .select()
    .from(workspaceInviteLinks)
    .where(
      and(
        eq(workspaceInviteLinks.token, token),
        eq(workspaceInviteLinks.isActive, true)
      )
    )
    .limit(1)

  if (!inviteLink) {
    redirect("/auth/signin?error=invalid_invite")
  }

  const session = await getServerSession(authOptions)
  const email = session?.user?.email?.trim().toLowerCase()

  if (!email) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/join/${token}`)}`)
  }

  const displayName =
    session?.user?.name?.trim() ||
    (email.includes("@") ? email.split("@")[0] : "User")

  let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!user) {
    ;[user] = await db
      .insert(users)
      .values({
        name: displayName,
        email,
        avatarUrl: session?.user?.image || null,
      })
      .returning()
  }

  if (!user) {
    redirect("/auth/signin?error=join_failed")
  }

  const [membership] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, inviteLink.workspaceId),
        eq(workspaceMembers.userId, user.id)
      )
    )
    .limit(1)

  if (!membership) {
    await db.insert(workspaceMembers).values({
      workspaceId: inviteLink.workspaceId,
      userId: user.id,
      role: "member",
    })
  }

  const workspaceChannels = await db
    .select({ id: channels.id })
    .from(channels)
    .where(eq(channels.workspaceId, inviteLink.workspaceId))

  for (const channel of workspaceChannels) {
    const [channelMembership] = await db
      .select()
      .from(channelMembers)
      .where(
        and(
          eq(channelMembers.channelId, channel.id),
          eq(channelMembers.userId, user.id)
        )
      )
      .limit(1)

    if (!channelMembership) {
      await db.insert(channelMembers).values({
        channelId: channel.id,
        userId: user.id,
      })
    }
  }

  redirect("/workspace")
}
