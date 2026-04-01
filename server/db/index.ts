import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

const connectionString = process.env.DATABASE_URL!

// Use global singleton to prevent connection exhaustion during dev hot reloads
const globalForDb = globalThis as unknown as {
  pgClient: ReturnType<typeof postgres> | undefined
}

const client = globalForDb.pgClient ?? postgres(connectionString, { max: 10 })

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client
}

export const db = drizzle(client, { schema })
