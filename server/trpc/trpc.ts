import { initTRPC } from "@trpc/server"
import superjson from "superjson"
import { db } from "../db"

export type Context = {
  db: typeof db
  userId: string | null
}

export function createContext(userId?: string | null): Context {
  return {
    db,
    userId: userId ?? null,
  }
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
})

export const router = t.router
export const publicProcedure = t.procedure
export const createCallerFactory = t.createCallerFactory
