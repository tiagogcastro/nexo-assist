import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from '@/db/schema/auth';

const createdAt = timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  tokenHash: text('token_hash'),
  invitedBy: text('invited_by').references(() => user.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt,
});

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  description: text('description').notNull().default(''),
  active: boolean('active').notNull().default(true),
  protected: boolean('protected').notNull().default(false),
  createdAt,
});

export const permissions = pgTable('permissions', {
  key: text('key').primaryKey(),
  description: text('description').notNull(),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionKey: text('permission_key')
      .notNull()
      .references(() => permissions.key, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionKey] })],
);

export const userRoles = pgTable(
  'user_roles',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
);

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: text('employee_id')
      .notNull()
      .references(() => user.id),
    title: text('title').notNull().default('Nova conversa'),
    state: text('state').notNull().default('agent_active'),
    assignedAnalystId: text('assigned_analyst_id').references(() => user.id),
    messageCount: integer('message_count').notNull().default(0),
    version: integer('version').notNull().default(0),
    createdAt,
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('conversations_employee_idx').on(table.employeeId),
    index('conversations_state_idx').on(table.state),
  ],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id),
    authorId: text('author_id').references(() => user.id),
    role: text('role').notNull(),
    content: text('content').notNull(),
    requestKey: text('request_key'),
    decisionId: uuid('decision_id'),
    createdAt,
  },
  (table) => [
    index('messages_conversation_idx').on(table.conversationId, table.createdAt),
    uniqueIndex('messages_request_key_idx').on(table.conversationId, table.requestKey),
  ],
);

export const ticketSequence = pgTable('ticket_sequence', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
});

export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(),
    creatorId: text('creator_id')
      .notNull()
      .references(() => user.id),
    affectedUserId: text('affected_user_id')
      .notNull()
      .references(() => user.id),
    assignedAnalystId: text('assigned_analyst_id').references(() => user.id),
    conversationId: uuid('conversation_id').references(() => conversations.id),
    type: text('type').notNull(),
    category: text('category').notNull(),
    priority: text('priority').notNull(),
    status: text('status').notNull().default('open'),
    title: text('title').notNull(),
    description: text('description').notNull(),
    normalizedProblem: text('normalized_problem').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    lastResponseAt: timestamp('last_response_at', { withTimezone: true }),
    createdAt,
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('tickets_creator_idx').on(table.creatorId, table.createdAt),
    index('tickets_normalized_idx').on(table.creatorId, table.normalizedProblem),
    uniqueIndex('tickets_active_problem_unique_idx')
      .on(table.creatorId, table.normalizedProblem)
      .where(sql`${table.status} IN ('open', 'awaiting_analyst', 'approved')`),
  ],
);

export const ticketDrafts = pgTable(
  'ticket_drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id),
    creatorId: text('creator_id')
      .notNull()
      .references(() => user.id),
    ticketId: uuid('ticket_id').references(() => tickets.id),
    action: text('action').notNull(),
    payload: jsonb('payload').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    resultTicketId: uuid('result_ticket_id').references(() => tickets.id),
    createdAt,
  },
  (table) => [index('ticket_drafts_creator_idx').on(table.creatorId)],
);

export const ticketEvents = pgTable('ticket_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id')
    .notNull()
    .references(() => tickets.id),
  actorId: text('actor_id').references(() => user.id),
  action: text('action').notNull(),
  metadata: jsonb('metadata')
    .notNull()
    .default(sql`'{}'::jsonb`),
  createdAt,
});

export const helpArticles = pgTable(
  'help_articles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt,
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('help_articles_search_idx').using(
      'gin',
      sql`to_tsvector('portuguese', ${table.title} || ' ' || ${table.body})`,
    ),
  ],
);

export const handoffs = pgTable('handoffs', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id),
  requestedBy: text('requested_by')
    .notNull()
    .references(() => user.id),
  claimedBy: text('claimed_by').references(() => user.id),
  summary: text('summary').notNull(),
  state: text('state').notNull().default('pending'),
  createdAt,
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
});

export const agentDecisions = pgTable('agent_decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id),
  messageId: uuid('message_id').references(() => messages.id),
  intent: text('intent').notNull(),
  action: text('action').notNull(),
  evidence: jsonb('evidence')
    .notNull()
    .default(sql`'{}'::jsonb`),
  rationale: text('rationale').notNull(),
  confidence: text('confidence').notNull(),
  createdAt,
});

export const aiProviders = pgTable('ai_providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind').notNull(),
  name: text('name').notNull(),
  encryptedKey: text('encrypted_key').notNull(),
  active: boolean('active').notNull().default(false),
  createdAt,
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const aiModels = pgTable('ai_models', {
  id: uuid('id').primaryKey().defaultRandom(),
  providerId: uuid('provider_id')
    .notNull()
    .references(() => aiProviders.id),
  modelId: text('model_id').notNull(),
  active: boolean('active').notNull().default(false),
  priceInputPerMillion: integer('price_input_per_million'),
  priceOutputPerMillion: integer('price_output_per_million'),
  createdAt,
});

export const aiUsage = pgTable('ai_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id),
  actorId: text('actor_id').references(() => user.id),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  cachedTokens: integer('cached_tokens'),
  latencyMs: integer('latency_ms'),
  estimatedCostUsdMicros: integer('estimated_cost_usd_micros'),
  status: text('status').notNull(),
  createdAt,
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: text('actor_id').references(() => user.id),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id'),
  requestId: text('request_id').notNull(),
  outcome: text('outcome').notNull(),
  metadata: jsonb('metadata')
    .notNull()
    .default(sql`'{}'::jsonb`),
  createdAt,
});
