import { z } from "zod"
import { router, publicProcedure } from "../trpc"
import { workspaces, workspaceMembers, channels } from "../../db/schema"
import { eq } from "drizzle-orm"

export const workspaceRouter = router({
  // For MVP: get the first (only) workspace
  getDefault: publicProcedure.query(async ({ ctx }) => {
    const [workspace] = await ctx.db.select().from(workspaces).limit(1)
    return workspace ?? null
  }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(80),
        userId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const slug = input.name.toLowerCase().replace(/\s+/g, "-")

      const [workspace] = await ctx.db
        .insert(workspaces)
        .values({ name: input.name, slug })
        .returning()

      // Add creator as admin
      await ctx.db
        .insert(workspaceMembers)
        .values({
          workspaceId: workspace.id,
          userId: input.userId,
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
      ])

      return workspace
    }),
})
