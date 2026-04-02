import fs from "fs"
import path from "path"
import postgres from "postgres"

const envPath = path.join(process.cwd(), ".env")
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, "utf-8")
  for (const line of env.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const idx = trimmed.indexOf("=")
    if (idx <= 0) continue
    const key = trimmed.slice(0, idx)
    let value = trimmed.slice(idx + 1)
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL missing")
}

const sql = postgres(process.env.DATABASE_URL)

const dups = await sql`
  select workspace_id, name, array_agg(id order by created_at asc, id asc) as ids
  from channels
  group by workspace_id, name
  having count(*) > 1
`

for (const row of dups) {
  const [keep, ...remove] = row.ids
  for (const dupId of remove) {
    await sql`
      insert into channel_members (id, channel_id, user_id)
      select gen_random_uuid(), ${keep}::uuid, cm.user_id
      from channel_members cm
      where cm.channel_id = ${dupId}::uuid
      and not exists (
        select 1
        from channel_members x
        where x.channel_id = ${keep}::uuid
          and x.user_id = cm.user_id
      )
    `

    await sql`
      update messages
      set channel_id = ${keep}::uuid
      where channel_id = ${dupId}::uuid
    `

    await sql`delete from channel_members where channel_id = ${dupId}::uuid`
    await sql`delete from channels where id = ${dupId}::uuid`
  }
}

console.log("deduped channel groups:", dups.length)
await sql.end()
