import 'dotenv/config'
import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const sql = postgres(url)

try {
  await sql`create table if not exists agent_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    conversation_id text not null,
    title text,
    tag text,
    project_path text,
    model_id text,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
  )`

  await sql`create unique index if not exists agent_sessions_user_conversation_uidx
    on agent_sessions(user_id, conversation_id)`

  await sql`create index if not exists agent_sessions_user_updated_idx
    on agent_sessions(user_id, updated_at)`

  await sql`create table if not exists agent_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    conversation_id text not null,
    ts timestamp not null default now(),
    type text not null,
    payload jsonb not null
  )`

  await sql`create index if not exists agent_events_user_conversation_ts_idx
    on agent_events(user_id, conversation_id, ts)`

  await sql`create table if not exists agent_user_state (
    user_id uuid primary key references users(id) on delete cascade,
    state jsonb not null,
    updated_at timestamp not null default now()
  )`

  console.log('Agent DB tables are ready')
} finally {
  await sql.end({ timeout: 5 })
}
