# Architecture

Nexo Assist is a Next.js fullstack modular monolith. UI pages and versioned browser/external APIs live in `src/app/`. Domain services live in `src/modules/`; the Mastra agent calls those services directly through scoped tools. PostgreSQL is the only durable state. Drizzle schemas and versioned migrations are in `src/db/` and `drizzle/`.

## Trust boundaries

Better Auth establishes a server-side identity and session. Database roles and permissions authorize each operation independently. The browser and LLM cannot supply a trusted user ID, permission, ticket owner, or final priority. Employee ticket queries use the creator ID. Analyst actions require role permissions and an available or assigned conversation. Administrative mutations require dedicated permissions. Inactive accounts are blocked.

Ticket mutations are two-phase: a validated draft is stored, shown to the employee, and then confirmed through a protected endpoint. Confirmation is transactional and idempotent. Unconfirmed drafts do not change tickets. Human handoff changes persisted conversation state atomically; agent output is checked against that state before storage. The 30-visible-message limit is enforced in database updates.

## Data and integration flow

`Browser → Next.js route → authenticated actor → domain service → PostgreSQL`. A chat request additionally reserves an AI usage record, constructs a per-request Mastra agent, streams observable events, and stores a final message only while the conversation is agent-active. AI tools can search help articles, read the actor's tickets, prepare drafts, and request handoff. They cannot confirm ticket writes.

Provider credentials use AES-256-GCM with a server-only environment key. Administrators test a credential against the provider's models API before activation. If no database provider is active, an optional DeepSeek environment key is used. Unknown token counts remain null. Administrators may set USD prices per million input and output tokens for a model; estimated cost is calculated only when both prices and observed token counts are present. Usage, agent decisions, and audit events are separate records.

The help center uses PostgreSQL full-text search. An analyst console polls for changes rather than holding a WebSocket. The ticket service has its own contracts and outage simulation, but shares deployment and database with the monolith.

## Persistence and deployment

Schema migrations are versioned in `drizzle/`. Run migrations before starting a new deployment. Use managed PostgreSQL with backups and TLS for production; filesystem state and process memory are not sources of truth. The encryption key and Better Auth secret must persist across deploys. See [deployment](deployment.md).
