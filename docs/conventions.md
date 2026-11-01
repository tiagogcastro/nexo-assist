# Code conventions

Use strict TypeScript and domain-first modules. React components use PascalCase filenames; other files use kebab-case. Functions and variables use camelCase, SQL uses snake_case, and user-facing text is in Brazilian Portuguese. Use two spaces, semicolons, single quotes, a 100-character Prettier width, named exports except framework entry points, and `@/` imports.

Domain services return `{ data: T, error: null } | { data: null, error: AppError }`. Validate untrusted inputs with Zod `safeParse`; catch library exceptions at adapter boundaries. Avoid explicit first-party business exceptions, broad class hierarchies, redundant wrappers, and global state that duplicates PostgreSQL.

Each server operation resolves the authenticated actor and checks database-backed permission and data scope. The UI may reflect permissions but is never an authorization boundary. Ticket writes require draft confirmation, and mutations must remain idempotent or conditional under concurrency.
