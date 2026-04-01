import "server-only"
import { createCallerFactory, createContext } from "@/server/trpc/trpc"
import { appRouter } from "@/server/trpc/router"

const createCaller = createCallerFactory(appRouter)

export const serverTrpc = createCaller(createContext)
