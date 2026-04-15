import { z } from "zod"
import { router, publicProcedure } from "../trpc"
import { users, workspaceMembers } from "../../db/schema"
import { eq } from "drizzle-orm"

export const userRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          workspaceId: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      if (input?.workspaceId) {
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
      return ctx.db.select().from(users).orderBy(users.name)
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.id, input.id))
      return user ?? null
    }),
})
