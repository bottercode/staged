import { initTRPC } from "@trpc/server"
import superjson from "superjson"
import { db } from "../db"

export type Context = {
  db: typeof db
  userId: string | null
}

export function createContext(): Context {
  return {
    db,
    userId: null, // set by middleware from cookie/header
  }
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
})

export const router = t.router
export const publicProcedure = t.procedure
export const createCallerFactory = t.createCallerFactory
