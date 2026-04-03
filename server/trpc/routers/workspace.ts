import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, publicProcedure } from "../trpc"
import {
  workspaces,
  workspaceMembers,
  workspaceInvites,
  workspaceInviteLinks,
  channels,
  users,
  channelMembers,
  boards,
  boardColumns,
  docs,
  portals,
} from "../../db/schema"
import { and, desc, eq, ne, sql } from "drizzle-orm"
import { sendWorkspaceInviteEmail } from "@/server/email"
import { randomUUID } from "crypto"

export const workspaceRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) return []
    return ctx.db
      .selectDistinct({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        createdAt: workspaces.createdAt,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, ctx.userId))
      .orderBy(desc(workspaces.createdAt))
  }),

  // Safety endpoint to repair accidental duplicate memberships from old flows.
  dedupeMemberships: publicProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) return { ok: false }
      const memberships = await ctx.db
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, input.workspaceId),
            eq(workspaceMembers.userId, ctx.userId)
          )
        )
      if (memberships.length <= 1) return { ok: true, removed: 0 }
      const [keep, ...rest] = memberships
      for (const membership of rest) {
        await ctx.db
          .delete(workspaceMembers)
          .where(eq(workspaceMembers.id, membership.id))
      }
      return { ok: true, removed: rest.length, kept: keep.id }
    }),

  // For MVP: get the first (only) workspace
  getDefault: publicProcedure
    .input(
      z
        .object({
          preferredWorkspaceId: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const preferredId = input?.preferredWorkspaceId
      if (preferredId && ctx.userId) {
        const [preferred] = await ctx.db
          .select({
            id: workspaces.id,
            name: workspaces.name,
            slug: workspaces.slug,
            createdAt: workspaces.createdAt,
          })
          .from(workspaceMembers)
          .innerJoin(
            workspaces,
            eq(workspaceMembers.workspaceId, workspaces.id)
          )
          .where(
            and(
              eq(workspaceMembers.userId, ctx.userId),
              eq(workspaces.id, preferredId)
            )
          )
          .limit(1)
        if (preferred) return preferred
      }

      if (ctx.userId) {
        const [workspace] = await ctx.db
          .select({
            id: workspaces.id,
            name: workspaces.name,
            slug: workspaces.slug,
            createdAt: workspaces.createdAt,
          })
          .from(workspaceMembers)
          .innerJoin(
            workspaces,
            eq(workspaceMembers.workspaceId, workspaces.id)
          )
          .where(eq(workspaceMembers.userId, ctx.userId))
          .orderBy(desc(workspaces.createdAt))
          .limit(1)
        return workspace ?? null
      }

      const [workspace] = await ctx.db
        .select()
        .from(workspaces)
        .orderBy(desc(workspaces.createdAt))
        .limit(1)
      return workspace ?? null
    }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(80),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Authentication required",
        })
      }
      const normalizedName = input.name.trim().toLowerCase()
      const [existingByName] = await ctx.db
        .select({
          id: workspaces.id,
          name: workspaces.name,
          slug: workspaces.slug,
          createdAt: workspaces.createdAt,
        })
        .from(workspaces)
        .where(sql`lower(${workspaces.name}) = ${normalizedName}`)
        .limit(1)
      if (existingByName) {
        const [membership] = await ctx.db
          .select({ id: workspaceMembers.id })
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, existingByName.id),
              eq(workspaceMembers.userId, ctx.userId)
            )
          )
          .limit(1)
        if (membership) {
          // Idempotent create for same user/name.
          return existingByName
        }
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Workspace name already exists. Please choose a different name.",
        })
      }

      const baseSlug =
        input.name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "") || "workspace"

      let workspace:
        | {
            id: string
            name: string
            slug: string
            createdAt: Date
          }
        | undefined

      // Ensure global unique slug across all workspaces, even when users pick same names.
      for (let attempt = 0; attempt < 20; attempt++) {
        const candidateSlug =
          attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`
        try {
          const [created] = await ctx.db
            .insert(workspaces)
            .values({ name: input.name.trim(), slug: candidateSlug })
            .returning()
          workspace = created
          break
        } catch (error: unknown) {
          const code =
            typeof error === "object" && error !== null && "code" in error
              ? String((error as { code?: unknown }).code)
              : ""
          if (code === "23505") {
            continue
          }
          throw error
        }
      }

      if (!workspace) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Could not create workspace name. Try a different name.",
        })
      }

      // Add creator as admin
      await ctx.db.insert(workspaceMembers).values({
        workspaceId: workspace.id,
        userId: ctx.userId,
        role: "admin",
      })

      // Auto-create default channels
      await ctx.db.insert(channels).values([
        {
          workspaceId: workspace.id,
          name: "general",
          slug: "general",
          description: "Company-wide announcements and updates",
        },
        {
          workspaceId: workspace.id,
          name: "random",
          slug: "random",
          description: "Non-work chatter and fun stuff",
        },
        {
          workspaceId: workspace.id,
          name: "engineering",
          slug: "engineering",
          description: "Engineering discussions and code reviews",
        },
      ])

      // Auto-create a default project board for each new workspace.
      const [defaultBoard] = await ctx.db
        .insert(boards)
        .values({
          workspaceId: workspace.id,
          name: "Backlog",
        })
        .returning()

      await ctx.db.insert(boardColumns).values([
        { boardId: defaultBoard.id, name: "To Do", position: 0 },
        { boardId: defaultBoard.id, name: "In Progress", position: 1 },
        { boardId: defaultBoard.id, name: "Done", position: 2 },
      ])

      // Create one default doc for every new workspace.
      await ctx.db.insert(docs).values({
        workspaceId: workspace.id,
        title: "Getting Started",
        createdById: ctx.userId,
      })

      // Create one default client portal for every new workspace.
      await ctx.db.insert(portals).values({
        workspaceId: workspace.id,
        boardId: defaultBoard.id,
        name: "Default Portal",
        slug: `${workspace.slug}-portal-${randomUUID().slice(0, 8)}`,
        clientName: workspace.name,
        description: "Default portal for client updates",
        createdById: ctx.userId,
      })

      return workspace
    }),

  getMembers: publicProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          userId: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
          role: workspaceMembers.role,
          joinedAt: workspaceMembers.joinedAt,
        })
        .from(workspaceMembers)
        .innerJoin(users, eq(workspaceMembers.userId, users.id))
        .where(eq(workspaceMembers.workspaceId, input.workspaceId))
    }),

  inviteMember: publicProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        email: z.string().email(),
        role: z.enum(["admin", "member"]).default("member"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const email = input.email.trim().toLowerCase()

      const [existingUser] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1)
      if (existingUser) {
        const [membership] = await ctx.db
          .select()
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, input.workspaceId),
              eq(workspaceMembers.userId, existingUser.id)
            )
          )
          .limit(1)
        if (membership) {
          return { ok: true, alreadyMember: true }
        }
      }

      const [pending] = await ctx.db
        .select()
        .from(workspaceInvites)
        .where(
          and(
            eq(workspaceInvites.workspaceId, input.workspaceId),
            eq(workspaceInvites.email, email),
            eq(workspaceInvites.status, "pending")
          )
        )
        .limit(1)

      if (pending) {
        await ctx.db
          .update(workspaceInvites)
          .set({ role: input.role })
          .where(eq(workspaceInvites.id, pending.id))
        const [workspace] = await ctx.db
          .select()
          .from(workspaces)
          .where(eq(workspaces.id, input.workspaceId))
          .limit(1)
        const emailResult = await sendWorkspaceInviteEmail({
          toEmail: email,
          workspaceName: workspace?.name || "Workspace",
          role: input.role,
        }).catch((error) => ({
          sent: false,
          reason:
            error instanceof Error
              ? `runtime_error:${error.message}`
              : "runtime_error",
        }))

        return {
          ok: true,
          alreadyMember: false,
          inviteId: pending.id,
          emailSent: emailResult.sent,
          emailError: emailResult.sent ? null : emailResult.reason,
        }
      }

      const [invite] = await ctx.db
        .insert(workspaceInvites)
        .values({
          workspaceId: input.workspaceId,
          email,
          role: input.role,
          status: "pending",
          invitedById: ctx.userId ?? null,
        })
        .returning()

      const [workspace] = await ctx.db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, input.workspaceId))
        .limit(1)
      const emailResult = await sendWorkspaceInviteEmail({
        toEmail: email,
        workspaceName: workspace?.name || "Workspace",
        role: input.role,
      }).catch((error) => ({
        sent: false,
        reason:
          error instanceof Error
            ? `runtime_error:${error.message}`
            : "runtime_error",
      }))

      return {
        ok: true,
        alreadyMember: false,
        inviteId: invite?.id,
        emailSent: emailResult.sent,
        emailError: emailResult.sent ? null : emailResult.reason,
      }
    }),

  listInvites: publicProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(workspaceInvites)
        .where(
          and(
            eq(workspaceInvites.workspaceId, input.workspaceId),
            eq(workspaceInvites.status, "pending")
          )
        )
        .orderBy(desc(workspaceInvites.createdAt))
    }),

  revokeInvite: publicProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        inviteId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(workspaceInvites)
        .where(
          and(
            eq(workspaceInvites.workspaceId, input.workspaceId),
            eq(workspaceInvites.id, input.inviteId)
          )
        )
      return { ok: true }
    }),

  removeMember: publicProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        userId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceChannelIds = await ctx.db
        .select({ id: channels.id })
        .from(channels)
        .where(eq(channels.workspaceId, input.workspaceId))

      for (const channel of workspaceChannelIds) {
        await ctx.db
          .delete(channelMembers)
          .where(
            and(
              eq(channelMembers.channelId, channel.id),
              eq(channelMembers.userId, input.userId)
            )
          )
      }

      await ctx.db
        .delete(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, input.workspaceId),
            eq(workspaceMembers.userId, input.userId)
          )
        )

      return { ok: true }
    }),

  getInviteLink: publicProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const [link] = await ctx.db
        .select()
        .from(workspaceInviteLinks)
        .where(
          and(
            eq(workspaceInviteLinks.workspaceId, input.workspaceId),
            eq(workspaceInviteLinks.isActive, true)
          )
        )
        .orderBy(desc(workspaceInviteLinks.createdAt))
        .limit(1)

      if (!link) return null
      const base = process.env.NEXTAUTH_URL || "http://localhost:3000"
      return {
        id: link.id,
        url: `${base}/join/${link.token}`,
        createdAt: link.createdAt,
        role: link.role as "member" | "admin",
      }
    }),

  createInviteLink: publicProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        role: z.enum(["member", "admin"]).default("member"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(workspaceInviteLinks)
        .set({ isActive: false })
        .where(eq(workspaceInviteLinks.workspaceId, input.workspaceId))

      const token = randomUUID().replaceAll("-", "")
      const [created] = await ctx.db
        .insert(workspaceInviteLinks)
        .values({
          workspaceId: input.workspaceId,
          token,
          isActive: true,
          role: input.role,
          createdById: ctx.userId ?? null,
        })
        .returning()

      const base = process.env.NEXTAUTH_URL || "http://localhost:3000"
      return {
        id: created?.id,
        url: `${base}/join/${token}`,
        createdAt: created?.createdAt ?? new Date(),
      }
    }),

  revokeInviteLink: publicProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        inviteLinkId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(workspaceInviteLinks)
        .set({ isActive: false })
        .where(
          and(
            eq(workspaceInviteLinks.workspaceId, input.workspaceId),
            eq(workspaceInviteLinks.id, input.inviteLinkId)
          )
        )
      return { ok: true }
    }),

  updateTitle: publicProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        name: z.string().min(1).max(80),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const normalizedName = input.name.trim().toLowerCase()
      const [nameConflict] = await ctx.db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(
          and(
            sql`lower(${workspaces.name}) = ${normalizedName}`,
            ne(workspaces.id, input.workspaceId)
          )
        )
        .limit(1)
      if (nameConflict) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Workspace name already exists. Please choose a different name.",
        })
      }

      const slug = input.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")

      const [updated] = await ctx.db
        .update(workspaces)
        .set({
          name: input.name.trim(),
          slug: slug || "workspace",
        })
        .where(eq(workspaces.id, input.workspaceId))
        .returning()

      return updated ?? null
    }),

  leave: publicProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        userId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceChannelIds = await ctx.db
        .select({ id: channels.id })
        .from(channels)
        .where(eq(channels.workspaceId, input.workspaceId))
      for (const channel of workspaceChannelIds) {
        await ctx.db
          .delete(channelMembers)
          .where(
            and(
              eq(channelMembers.channelId, channel.id),
              eq(channelMembers.userId, input.userId)
            )
          )
      }
      await ctx.db
        .delete(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, input.workspaceId),
            eq(workspaceMembers.userId, input.userId)
          )
        )
      return { ok: true }
    }),
})
