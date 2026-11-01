# Nexo Assist | Agent Engineering Rules

This is an AI-enabled IT service desk application. Public documentation describes the product and its verified behavior. Keep private requirements and design source files out of the repository.

## Required reading and precedence

Before changing behavior, read `docs/architecture.md`, `docs/conventions.md`, `docs/requirements.md`, `docs/business-rules.md`, and `docs/decisions.md`. Treat the code and versioned migrations as the current implementation, preserve the established product behavior and visual layouts, and record intentional changes in the relevant documentation. Owner-approved decisions supersede documented defaults. Prioritize security and data integrity.

## Engineering contract

- Next.js fullstack modular monolith, strict TypeScript, Mastra, Better Auth, PostgreSQL/Drizzle, pnpm, Tailwind, TanStack Query, React Hook Form + Zod as warranted.
- Domain-first modules. Direct calls to server-side services; versioned REST for external/browser access. The ticket service is independent of the agent in contracts and authorization, not a separate deployment.
- No explicit `throw` in first-party business/application code. Use `Result<T>` as `{ data: T; error: null } | { data: null; error: AppError }`. Never use result flags `success` or `ok`. Narrow, adapter-boundary `try/catch` is permitted for libraries which throw. Zod `safeParse` only at untrusted inputs.
- Do not add redundant abstractions, class hierarchies, barrel exports, mocks presented as live functionality, unrelated dependencies, unnecessary tests, or generated TODO stubs.
- Preserve the six established employee and analyst desktop views; build complementary admin screens separately. Mobile adapts functionality without redesigning desktop.
- Each operation checks server-trusted authorization, with dynamic database-backed roles/permissions and carefully scoped data access. Better Auth handles identity; do not rely on static hardcoded roles for all authorization.
- All ticket writes require explicit draft confirmation and idempotent mutation. Restrict employee ticket data to the creator. Human handoff pauses AI responses, including in-flight work, and is concurrency-safe.
- Track usage, decisions and audit separately; record observed metrics accurately, mark costs estimated when applicable; encrypt provider keys on the server, never reveal secrets.
- Full persistent history across deployments/restarts. Rate and token limits to protect hosted demonstration. Narrow tests for high-risk invariants only.
- Implement in ordered phases, verify impacted acceptance requirements and typecheck/lint/build, then create Conventional Commits for validated phases. Never push or deploy without appropriate configured access.
- Do not request decisions already specified. When integrations lack credentials, report blockers accurately and complete independent work.

## Developer conventions

- Files: PascalCase React components, kebab-case other files, camelCase domain directories, Next.js file conventions unchanged.
- Names: camelCase functions/variables, PascalCase types/components, `UPPER_SNAKE_CASE` true globals, SQL snake_case, TypeScript fields camelCase.
- 2 spaces, semicolons, single quotes, Prettier width 100, imports `@/`, named exports except framework requirements, function declarations, early returns, braces always.
- Blank line between distinct validation, I/O, branching, transformation and return blocks. Keep functions short, avoid over-nesting and nested ternaries.
- Prefer `type`, unions and guarded narrowing; use `as const` only for literal constants, avoid unsafe `as`, `!`, and `any`.
- Functions take named object arguments for multiple inputs; `get` required, `find` optional, `list` collections. Domain helpers colocated; shared lib only when truly reused.
- Documentation/code identifiers in English; user-facing copy in pt-BR.
