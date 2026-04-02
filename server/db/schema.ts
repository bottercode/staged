import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { relations, sql } from "drizzle-orm"

// ── Users ──────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const usersRelations = relations(users, ({ many }) => ({
  workspaceMembers: many(workspaceMembers),
  channelMembers: many(channelMembers),
  messages: many(messages),
  dmMembers: many(directMessageMembers),
}))

// ── Workspaces ─────────────────────────────────────────
export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
  channels: many(channels),
  dmRooms: many(directMessageRooms),
}))

// ── Agent Persistence ───────────────────────────────────
export const agentSessions = pgTable(
  "agent_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").notNull(),
    title: text("title"),
    tag: text("tag"),
    projectPath: text("project_path"),
    modelId: text("model_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userConversationUnique: uniqueIndex("agent_sessions_user_conversation_uidx").on(
      table.userId,
      table.conversationId
    ),
    userUpdatedIdx: index("agent_sessions_user_updated_idx").on(
      table.userId,
      table.updatedAt
    ),
  })
)

export const agentEvents = pgTable(
  "agent_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").notNull(),
    ts: timestamp("ts").defaultNow().notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  },
  (table) => ({
    userConversationTsIdx: index("agent_events_user_conversation_ts_idx").on(
      table.userId,
      table.conversationId,
      table.ts
    ),
  })
)

export const agentUserState = pgTable("agent_user_state", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  state: jsonb("state").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// ── Workspace Members ──────────────────────────────────
export const workspaceMembers = pgTable("workspace_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
})

export const workspaceMembersRelations = relations(
  workspaceMembers,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceMembers.workspaceId],
      references: [workspaces.id],
    }),
    user: one(users, {
      fields: [workspaceMembers.userId],
      references: [users.id],
    }),
  })
)

export const workspaceInviteLinks = pgTable("workspace_invite_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdById: uuid("created_by_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const workspaceInviteLinksRelations = relations(
  workspaceInviteLinks,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceInviteLinks.workspaceId],
      references: [workspaces.id],
    }),
    createdBy: one(users, {
      fields: [workspaceInviteLinks.createdById],
      references: [users.id],
    }),
  })
)

export const workspaceInvites = pgTable("workspace_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("pending"),
  invitedById: uuid("invited_by_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const workspaceInvitesRelations = relations(
  workspaceInvites,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceInvites.workspaceId],
      references: [workspaces.id],
    }),
    invitedBy: one(users, {
      fields: [workspaceInvites.invitedById],
      references: [users.id],
    }),
  })
)

// ── Channels ───────────────────────────────────────────
export const channels = pgTable("channels", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  isPrivate: boolean("is_private").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const channelsRelations = relations(channels, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [channels.workspaceId],
    references: [workspaces.id],
  }),
  members: many(channelMembers),
  messages: many(messages),
}))

// ── Channel Members ────────────────────────────────────
export const channelMembers = pgTable("channel_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  channelId: uuid("channel_id")
    .notNull()
    .references(() => channels.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
})

export const channelMembersRelations = relations(channelMembers, ({ one }) => ({
  channel: one(channels, {
    fields: [channelMembers.channelId],
    references: [channels.id],
  }),
  user: one(users, {
    fields: [channelMembers.userId],
    references: [users.id],
  }),
}))

// ── Messages ───────────────────────────────────────────
export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  channelId: uuid("channel_id").references(() => channels.id, {
    onDelete: "cascade",
  }),
  dmRoomId: uuid("dm_room_id").references(() => directMessageRooms.id, {
    onDelete: "cascade",
  }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  parentId: uuid("parent_id"),
  replyCount: integer("reply_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const messagesRelations = relations(messages, ({ one, many }) => ({
  channel: one(channels, {
    fields: [messages.channelId],
    references: [channels.id],
  }),
  dmRoom: one(directMessageRooms, {
    fields: [messages.dmRoomId],
    references: [directMessageRooms.id],
  }),
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
  parent: one(messages, {
    fields: [messages.parentId],
    references: [messages.id],
    relationName: "thread",
  }),
  replies: many(messages, { relationName: "thread" }),
}))

// ── Direct Message Rooms ───────────────────────────────
export const directMessageRooms = pgTable("direct_message_rooms", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const directMessageRoomsRelations = relations(
  directMessageRooms,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [directMessageRooms.workspaceId],
      references: [workspaces.id],
    }),
    members: many(directMessageMembers),
    messages: many(messages),
  })
)

// ── Direct Message Members ─────────────────────────────
export const directMessageMembers = pgTable("direct_message_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => directMessageRooms.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
})

export const directMessageMembersRelations = relations(
  directMessageMembers,
  ({ one }) => ({
    room: one(directMessageRooms, {
      fields: [directMessageMembers.roomId],
      references: [directMessageRooms.id],
    }),
    user: one(users, {
      fields: [directMessageMembers.userId],
      references: [users.id],
    }),
  })
)

// ── Boards ─────────────────────────────────────────────
export const boards = pgTable("boards", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const boardsRelations = relations(boards, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [boards.workspaceId],
    references: [workspaces.id],
  }),
  columns: many(boardColumns),
  tasks: many(tasks),
}))

// ── Board Columns ──────────────────────────────────────
export const boardColumns = pgTable("board_columns", {
  id: uuid("id").defaultRandom().primaryKey(),
  boardId: uuid("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const boardColumnsRelations = relations(
  boardColumns,
  ({ one, many }) => ({
    board: one(boards, {
      fields: [boardColumns.boardId],
      references: [boards.id],
    }),
    tasks: many(tasks),
  })
)

// ── Tasks ──────────────────────────────────────────────
export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  boardId: uuid("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  columnId: uuid("column_id")
    .notNull()
    .references(() => boardColumns.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  assigneeId: uuid("assignee_id").references(() => users.id, {
    onDelete: "set null",
  }),
  priority: text("priority").notNull().default("medium"),
  dueDate: timestamp("due_date"),
  position: integer("position").notNull().default(0),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  channelMessageId: uuid("channel_message_id"),
  labels: text("labels")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const taskComments = pgTable("task_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// ── Portals ───────────────────────────────────────────
export const portals = pgTable("portals", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  boardId: uuid("board_id").references(() => boards.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email"),
  description: text("description"),
  status: text("status").notNull().default("active"),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const portalsRelations = relations(portals, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [portals.workspaceId],
    references: [workspaces.id],
  }),
  board: one(boards, {
    fields: [portals.boardId],
    references: [boards.id],
  }),
  createdBy: one(users, {
    fields: [portals.createdById],
    references: [users.id],
  }),
  updates: many(portalUpdates),
}))

// ── Portal Updates ────────────────────────────────────
export const portalUpdates = pgTable("portal_updates", {
  id: uuid("id").defaultRandom().primaryKey(),
  portalId: uuid("portal_id")
    .notNull()
    .references(() => portals.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  type: text("type").notNull().default("update"),
  status: text("status").notNull().default("none"),
  reviewedByName: text("reviewed_by_name"),
  reviewedAt: timestamp("reviewed_at"),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const portalUpdatesRelations = relations(
  portalUpdates,
  ({ one, many }) => ({
    portal: one(portals, {
      fields: [portalUpdates.portalId],
      references: [portals.id],
    }),
    createdBy: one(users, {
      fields: [portalUpdates.createdById],
      references: [users.id],
    }),
    comments: many(portalComments),
  })
)

// ── Portal Comments ───────────────────────────────────
export const portalComments = pgTable("portal_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  updateId: uuid("update_id")
    .notNull()
    .references(() => portalUpdates.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  authorType: text("author_type").notNull().default("client"),
  authorName: text("author_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const portalCommentsRelations = relations(portalComments, ({ one }) => ({
  update: one(portalUpdates, {
    fields: [portalComments.updateId],
    references: [portalUpdates.id],
  }),
}))

// ── Docs ──────────────────────────────────────────────
export const docs = pgTable("docs", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("Untitled"),
  content: text("content"),
  emoji: text("emoji"),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const docsRelations = relations(docs, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [docs.workspaceId],
    references: [workspaces.id],
  }),
  createdBy: one(users, {
    fields: [docs.createdById],
    references: [users.id],
  }),
}))

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  board: one(boards, {
    fields: [tasks.boardId],
    references: [boards.id],
  }),
  column: one(boardColumns, {
    fields: [tasks.columnId],
    references: [boardColumns.id],
  }),
  workspace: one(workspaces, {
    fields: [tasks.workspaceId],
    references: [workspaces.id],
  }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
    relationName: "assignedTasks",
  }),
  createdBy: one(users, {
    fields: [tasks.createdById],
    references: [users.id],
    relationName: "createdTasks",
  }),
  comments: many(taskComments),
}))

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskComments.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskComments.userId],
    references: [users.id],
  }),
}))
