import { TRPCError } from "@trpc/server"
import { and, eq } from "drizzle-orm"
import {
  boards,
  channelMembers,
  channels,
  docs,
  directMessageMembers,
  portals,
  tasks,
  workspaceMembers,
} from "@/server/db/schema"
import type { Context } from "./trpc"

type WorkspaceRole = "admin" | "member"

export async function getWorkspaceRole(
  ctx: Context,
  workspaceId: string,
  userId: string
): Promise<WorkspaceRole | null> {
  const [membership] = await ctx.db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId)
      )
    )
    .limit(1)

  if (!membership) return null
  return membership.role === "admin" ? "admin" : "member"
}

export async function requireWorkspaceMember(
  ctx: Context,
  workspaceId: string,
  userId: string
) {
  const role = await getWorkspaceRole(ctx, workspaceId, userId)
  if (!role) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this workspace",
    })
  }
  return role
}

export async function requireWorkspaceAdmin(
  ctx: Context,
  workspaceId: string,
  userId: string
) {
  const role = await getWorkspaceRole(ctx, workspaceId, userId)
  if (role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only workspace admins can perform this action",
    })
  }
}

export async function workspaceIdByBoardId(ctx: Context, boardId: string) {
  const [row] = await ctx.db
    .select({ workspaceId: boards.workspaceId })
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1)
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Board not found" })
  }
  return row.workspaceId
}

export async function workspaceIdByTaskId(ctx: Context, taskId: string) {
  const [row] = await ctx.db
    .select({ workspaceId: tasks.workspaceId })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1)
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" })
  }
  return row.workspaceId
}

export async function workspaceIdByDocId(ctx: Context, docId: string) {
  const [row] = await ctx.db
    .select({ workspaceId: docs.workspaceId })
    .from(docs)
    .where(eq(docs.id, docId))
    .limit(1)
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Doc not found" })
  }
  return row.workspaceId
}

export async function workspaceIdByPortalId(ctx: Context, portalId: string) {
  const [row] = await ctx.db
    .select({ workspaceId: portals.workspaceId })
    .from(portals)
    .where(eq(portals.id, portalId))
    .limit(1)
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Portal not found" })
  }
  return row.workspaceId
}

export async function workspaceIdByChannelId(ctx: Context, channelId: string) {
  const [row] = await ctx.db
    .select({ workspaceId: channels.workspaceId })
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1)
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Channel not found" })
  }
  return row.workspaceId
}

export async function requireChannelAccess(
  ctx: Context,
  channelId: string,
  userId: string
) {
  const [channel] = await ctx.db
    .select({
      workspaceId: channels.workspaceId,
      isPrivate: channels.isPrivate,
    })
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1)

  if (!channel) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Channel not found" })
  }

  await requireWorkspaceMember(ctx, channel.workspaceId, userId)

  if (channel.isPrivate) {
    const [membership] = await ctx.db
      .select({ id: channelMembers.id })
      .from(channelMembers)
      .where(
        and(
          eq(channelMembers.channelId, channelId),
          eq(channelMembers.userId, userId)
        )
      )
      .limit(1)

    if (!membership) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You are not a member of this private channel",
      })
    }
  }

  return channel
}

export async function requireDmRoomMember(
  ctx: Context,
  roomId: string,
  userId: string
) {
  const [membership] = await ctx.db
    .select({ userId: directMessageMembers.userId })
    .from(directMessageMembers)
    .where(
      and(
        eq(directMessageMembers.roomId, roomId),
        eq(directMessageMembers.userId, userId)
      )
    )
    .limit(1)

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this DM room",
    })
  }
}
