import { z } from "zod"
import { router, publicProcedure } from "../trpc"
import { users } from "../../db/schema"
import { eq } from "drizzle-orm"

export const userRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
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
