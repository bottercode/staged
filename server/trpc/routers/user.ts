import { z } from "zod"
import { router, protectedProcedure } from "../trpc"
import { users, workspaceMembers } from "../../db/schema"
import { eq } from "drizzle-orm"
import { requireWorkspaceMember } from "@/server/trpc/access"

export const userRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          workspaceId: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      if (input?.workspaceId) {
        await requireWorkspaceMember(ctx, input.workspaceId, ctx.userId)
        return ctx.db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            avatarUrl: users.avatarUrl,
            createdAt: users.createdAt,
          })
          .from(users)
          .innerJoin(workspaceMembers, eq(workspaceMembers.userId, users.id))
          .where(eq(workspaceMembers.workspaceId, input.workspaceId))
          .orderBy(users.name)
      }
      return ctx.db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, ctx.userId))
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.id, input.id))
      return user ?? null
    }),
})
