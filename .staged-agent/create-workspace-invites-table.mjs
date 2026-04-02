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
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    if (!(key in process.env)) process.env[key] = value
  }
}

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing")

const sql = postgres(process.env.DATABASE_URL)

await sql`
create table if not exists workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member',
  status text not null default 'pending',
  invited_by_id uuid references users(id) on delete set null,
  created_at timestamp not null default now()
)
`

await sql`create index if not exists workspace_invites_workspace_id_idx on workspace_invites(workspace_id)`
await sql`create index if not exists workspace_invites_workspace_email_idx on workspace_invites(workspace_id, email)`

console.log("workspace_invites table ready")
await sql.end()
