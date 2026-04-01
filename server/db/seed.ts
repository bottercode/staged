import "dotenv/config"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

async function seed() {
  const client = postgres(process.env.DATABASE_URL!)
  const db = drizzle(client, { schema })

  console.log("🌱 Seeding database...")

  // Clean existing data
  await db.delete(schema.directMessageMembers)
  await db.delete(schema.directMessageRooms)
  await db.delete(schema.messages)
  await db.delete(schema.channelMembers)
  await db.delete(schema.channels)
  await db.delete(schema.workspaceMembers)
  await db.delete(schema.workspaces)
  await db.delete(schema.users)

  // Create users
  const [alice, bob, charlie] = await db
    .insert(schema.users)
    .values([
      {
        name: "Alice Johnson",
        email: "alice@staged.dev",
        avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=Alice",
      },
      {
        name: "Bob Smith",
        email: "bob@staged.dev",
        avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=Bob",
      },
      {
        name: "Charlie Park",
        email: "charlie@staged.dev",
        avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=Charlie",
      },
    ])
    .returning()

  console.log("✓ Created 3 users")

  // Create workspace
  const [workspace] = await db
    .insert(schema.workspaces)
    .values({
      name: "Staged HQ",
      slug: "staged-hq",
    })
    .returning()

  console.log("✓ Created workspace")

  // Add all users to workspace
  await db.insert(schema.workspaceMembers).values([
    { workspaceId: workspace.id, userId: alice.id, role: "admin" },
    { workspaceId: workspace.id, userId: bob.id, role: "member" },
    { workspaceId: workspace.id, userId: charlie.id, role: "member" },
  ])

  console.log("✓ Added members to workspace")

  // Create channels
  const [general, random, engineering] = await db
    .insert(schema.channels)
    .values([
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
        description: "Non-work chatter, memes, and fun stuff",
      },
      {
        workspaceId: workspace.id,
        name: "engineering",
        slug: "engineering",
        description: "Engineering discussions and code reviews",
      },
    ])
    .returning()

  console.log("✓ Created 3 channels")

  // Add all users to all channels
  for (const channel of [general, random, engineering]) {
    await db.insert(schema.channelMembers).values([
      { channelId: channel.id, userId: alice.id },
      { channelId: channel.id, userId: bob.id },
      { channelId: channel.id, userId: charlie.id },
    ])
  }

  console.log("✓ Added members to channels")

  // Seed messages in #general
  const generalMessages = await db
    .insert(schema.messages)
    .values([
      {
        channelId: general.id,
        userId: alice.id,
        content:
          "Welcome to Staged! This is the beginning of something great 🚀",
      },
      {
        channelId: general.id,
        userId: bob.id,
        content: "Excited to be here! The workspace feels really clean.",
      },
      {
        channelId: general.id,
        userId: charlie.id,
        content:
          "Just set up the engineering channel. Let's keep things organized from day one.",
      },
      {
        channelId: general.id,
        userId: alice.id,
        content:
          "Quick update — we're launching the client portal feature next week. Big milestone!",
      },
    ])
    .returning()

  // Add a thread reply
  await db.insert(schema.messages).values({
    channelId: general.id,
    userId: bob.id,
    content: "That's awesome! Do we have a doc outlining the portal specs?",
    parentId: generalMessages[3].id,
  })
  const { eq } = await import("drizzle-orm")
  await db
    .update(schema.messages)
    .set({ replyCount: 1 })
    .where(eq(schema.messages.id, generalMessages[3].id))

  // Seed messages in #engineering
  await db.insert(schema.messages).values([
    {
      channelId: engineering.id,
      userId: charlie.id,
      content: "Started the tRPC setup today. Using v11 with App Router.",
    },
    {
      channelId: engineering.id,
      userId: alice.id,
      content: "Nice! Are we going with Drizzle for the ORM?",
    },
    {
      channelId: engineering.id,
      userId: charlie.id,
      content: "Yep — Drizzle + Postgres. Schema is already looking solid.",
    },
  ])

  // Seed messages in #random
  await db.insert(schema.messages).values([
    {
      channelId: random.id,
      userId: bob.id,
      content: "Anyone watching the new season of that show?",
    },
    {
      channelId: random.id,
      userId: alice.id,
      content: "Which one? I need a new binge recommendation",
    },
  ])

  console.log("✓ Seeded messages")

  // Create a DM room between Alice and Bob
  const [dmRoom] = await db
    .insert(schema.directMessageRooms)
    .values({ workspaceId: workspace.id })
    .returning()

  await db.insert(schema.directMessageMembers).values([
    { roomId: dmRoom.id, userId: alice.id },
    { roomId: dmRoom.id, userId: bob.id },
  ])

  await db.insert(schema.messages).values([
    {
      dmRoomId: dmRoom.id,
      userId: alice.id,
      content: "Hey Bob, can you review the PR for the messaging module?",
    },
    {
      dmRoomId: dmRoom.id,
      userId: bob.id,
      content: "Sure thing, I'll take a look this afternoon!",
    },
  ])

  console.log("✓ Seeded DM conversation")

  // ── Boards & Tasks ─────────────────────────────────────
  await db.delete(schema.tasks)
  await db.delete(schema.boardColumns)
  await db.delete(schema.boards)

  const [board] = await db
    .insert(schema.boards)
    .values({ workspaceId: workspace.id, name: "Product Launch" })
    .returning()

  const [todo, inProgress, done] = await db
    .insert(schema.boardColumns)
    .values([
      { boardId: board.id, name: "To Do", position: 0 },
      { boardId: board.id, name: "In Progress", position: 1 },
      { boardId: board.id, name: "Done", position: 2 },
    ])
    .returning()

  await db.insert(schema.tasks).values([
    {
      boardId: board.id,
      columnId: todo.id,
      workspaceId: workspace.id,
      title: "Design landing page mockups",
      description: "Create high-fidelity mockups for the marketing site",
      assigneeId: alice.id,
      priority: "high",
      position: 0,
      createdById: alice.id,
    },
    {
      boardId: board.id,
      columnId: todo.id,
      workspaceId: workspace.id,
      title: "Write API documentation",
      assigneeId: charlie.id,
      priority: "medium",
      position: 1,
      createdById: alice.id,
    },
    {
      boardId: board.id,
      columnId: todo.id,
      workspaceId: workspace.id,
      title: "Set up CI/CD pipeline",
      priority: "low",
      position: 2,
      createdById: charlie.id,
    },
    {
      boardId: board.id,
      columnId: inProgress.id,
      workspaceId: workspace.id,
      title: "Build messaging module",
      description: "Channels, DMs, and threads",
      assigneeId: charlie.id,
      priority: "urgent",
      position: 0,
      createdById: alice.id,
    },
    {
      boardId: board.id,
      columnId: inProgress.id,
      workspaceId: workspace.id,
      title: "User onboarding flow",
      assigneeId: bob.id,
      priority: "high",
      position: 1,
      createdById: alice.id,
    },
    {
      boardId: board.id,
      columnId: done.id,
      workspaceId: workspace.id,
      title: "Set up project repo and tooling",
      assigneeId: charlie.id,
      priority: "medium",
      position: 0,
      createdById: charlie.id,
    },
  ])

  console.log("✓ Seeded board and tasks")

  // ── Portals ────────────────────────────────────────────
  await db.delete(schema.portalComments)
  await db.delete(schema.portalUpdates)
  await db.delete(schema.portals)

  const [portal] = await db
    .insert(schema.portals)
    .values({
      workspaceId: workspace.id,
      boardId: board.id,
      name: "Acme Corp Portal",
      slug: "acme-corp",
      clientName: "Sarah Chen",
      clientEmail: "sarah@acme.com",
      description: "Product launch project portal for Acme Corp",
      createdById: alice.id,
    })
    .returning()

  const [update1, update2, update3] = await db
    .insert(schema.portalUpdates)
    .values([
      {
        portalId: portal.id,
        content:
          "Project kickoff complete! We've set up the repo, configured CI/CD, and begun work on the messaging module. Expect first demos next week.",
        type: "update",
        createdById: alice.id,
      },
      {
        portalId: portal.id,
        content:
          "Landing page mockups are ready for review. We went with the minimal approach we discussed — clean typography, bold CTAs, and your brand colors throughout.",
        type: "deliverable",
        status: "none",
        createdById: alice.id,
      },
      {
        portalId: portal.id,
        content:
          "Messaging module is now functional — channels, DMs, and threaded replies all working. Moving on to the task board next.",
        type: "update",
        createdById: charlie.id,
      },
    ])
    .returning()

  await db.insert(schema.portalComments).values([
    {
      updateId: update1.id,
      content: "Great to hear! Looking forward to the demos.",
      authorType: "client",
      authorName: "Sarah Chen",
    },
  ])

  console.log("✓ Seeded portal with updates")

  // ── Docs ───────────────────────────────────────────────
  await db.delete(schema.docs)

  await db.insert(schema.docs).values([
    {
      workspaceId: workspace.id,
      title: "Welcome to Staged!",
      emoji: "👋",
      content: `<h1>Welcome to Staged!</h1><p>Everything you need. In one place.</p><h2>What is Staged?</h2><p>Staged is an all-in-one productivity workspace that brings together your messaging, project boards, client portals, docs, and team collaboration — all powered by AI that helps you get things done faster.</p><h2>Core Features</h2><ul><li><strong>Messaging</strong> — Team channels for real-time discussions</li><li><strong>Projects Board</strong> — Organize and track your work with a visual kanban board</li><li><strong>Client Portals</strong> — Share progress with clients, get approvals on deliverables</li><li><strong>Docs</strong> — Create and organize your team knowledge base</li><li><strong>Smart Threads</strong> — Turn any message into a task with one click</li></ul><h2>Getting Started</h2><ol><li><strong>Explore channels</strong> — Check out #general, #random, and #engineering</li><li><strong>Try the board</strong> — Drag tasks between columns in the Product Launch board</li><li><strong>Create a doc</strong> — Click the + button in the Docs sidebar</li><li><strong>Share with clients</strong> — Set up a portal and post updates</li></ol><hr><p>Built with Next.js, tRPC, and Drizzle. Designed for startups, remote teams, and agencies.</p>`,
      createdById: alice.id,
    },
    {
      workspaceId: workspace.id,
      title: "Engineering Standards",
      emoji: "⚙️",
      content: `<h1>Engineering Standards</h1><p>Guidelines for the engineering team at Staged.</p><h2>Code Style</h2><ul><li>Use TypeScript everywhere — no <code>any</code> types</li><li>Prefer functional components with hooks</li><li>Keep files under 300 lines — split if larger</li><li>Use <code>const</code> by default, <code>let</code> only when needed</li></ul><h2>Git Workflow</h2><ol><li>Branch from <code>main</code></li><li>Use conventional commits: <code>feat:</code>, <code>fix:</code>, <code>chore:</code></li><li>Open a PR, get at least one review</li><li>Squash merge into main</li></ol><h2>Stack</h2><blockquote><p>Next.js + tRPC + Drizzle + PostgreSQL + Tailwind CSS</p></blockquote><p>Keep it simple. Ship fast. Iterate.</p>`,
      createdById: charlie.id,
    },
    {
      workspaceId: workspace.id,
      title: "Meeting Notes — Sprint Planning",
      emoji: "📝",
      content: `<h1>Sprint Planning — Week 14</h1><p>Date: March 31, 2026</p><h2>Attendees</h2><ul><li>Alice Johnson</li><li>Bob Smith</li><li>Charlie Park</li></ul><h2>Decisions</h2><ul><li>Prioritize client portal feature for Acme Corp</li><li>Bob to handle onboarding flow</li><li>Charlie continues messaging module</li></ul><h2>Action Items</h2><ol><li>Alice — finalize landing page mockups by Wednesday</li><li>Bob — user onboarding prototype by Friday</li><li>Charlie — thread replies + notifications by Thursday</li></ol><h2>Notes</h2><p>We agreed to ship the MVP by end of next week. Focus on core flows, polish can come later.</p>`,
      createdById: alice.id,
    },
  ])

  console.log("✓ Seeded docs")
  console.log("🌱 Seed complete!")

  await client.end()
}

seed().catch(console.error)
