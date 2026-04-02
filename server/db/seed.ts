import "dotenv/config"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

async function seed() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required")
  }

  const client = postgres(process.env.DATABASE_URL)
  const db = drizzle(client, { schema })

  console.log("🧹 Clearing all existing app data (no demo seed)...")

  await db.delete(schema.portalComments)
  await db.delete(schema.portalUpdates)
  await db.delete(schema.portals)

  await db.delete(schema.tasks)
  await db.delete(schema.boardColumns)
  await db.delete(schema.boards)

  await db.delete(schema.docs)

  await db.delete(schema.messages)
  await db.delete(schema.directMessageMembers)
  await db.delete(schema.directMessageRooms)
  await db.delete(schema.channelMembers)
  await db.delete(schema.channels)

  await db.delete(schema.workspaceMembers)
  await db.delete(schema.workspaceInvites)
  await db.delete(schema.workspaceInviteLinks)
  await db.delete(schema.agentEvents)
  await db.delete(schema.agentSessions)
  await db.delete(schema.agentUserState)
  await db.delete(schema.workspaces)
  await db.delete(schema.users)

  await client.end()

  console.log("✓ Database cleared. No seeded demo data was inserted.")
}

seed().catch((error) => {
  console.error(error)
  process.exit(1)
})
