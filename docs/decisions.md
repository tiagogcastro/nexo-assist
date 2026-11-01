# Nexo Assist | Architecture Decisions & Trade-offs

- Modular monolith rather than microservices: minimal operational cost while preserving domain and external REST boundaries.
- PostgreSQL/Drizzle: reliable shared storage across serverless invocations; avoids SQLite or in-memory persistence.
- Mastra + AI SDK provider adapters: single agent framework with runtime model selection; DeepSeek API initializes the feature. Supported OAuth/delegated subscriptions require verified official third-party integration; ChatGPT Plus does not automatically include API usage.
- Better Auth for identity, **custom DB-backed role/permission evaluator** for dynamic application roles. Better Auth's admin plugin alone does not guarantee runtime dynamic global role CRUD; organization plugin introduces an unnecessary organization layer for single-company use case.
- Explicitly confirmed, idempotent ticket mutations; deterministic authorization and SLA outside LLM.
- User prefers no explicit throw in first-party services and no boolean status flags. Result envelope is `{data:T,error:null}` or `{data:null,error:AppError}`; framework/library exceptions normalized at adapters when necessary.
- PostgreSQL full-text search rather than embedding search to keep knowledge lookup clear, cheap and auditable for 5-10 articles.
- TanStack Query polling for analyst console; streaming for LLM. No Redis/WebSocket unless justified.
- Use real auth instead of any-password demo login to improve product realism, with secure demo accounts and reproducible bootstrap.
- Minimal test suite only for invariants that matter; manual screenshot/flow checks for visual fidelity.
- Default 30-message visible session cap, calculated server-side, independent of AI request/chunk count.
- Critical SLA is 24/7; business-hour SLA uses America/Sao_Paulo M-F 08:00-18:00 excluding no holidays initially.
- Administration screens have a separate layout from the employee and analyst workspaces.
