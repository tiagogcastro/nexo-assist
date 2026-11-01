# Deployment

The application is ready for a Next.js-compatible Node.js host and an external PostgreSQL instance. No hosted deployment is claimed until a real URL, database, migrations, and authenticated flows are verified.

1. Provision PostgreSQL with backups and TLS. Use a connection URL with the host's required SSL settings. Do not use the Docker Compose database for hosted production.
2. Configure `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, and `PROVIDER_ENCRYPTION_KEY` as secret environment values. Keep auth and encryption secrets stable across releases. Set demo budget limits and either `DEEPSEEK_API_KEY` or configure a provider through the admin UI.
3. Optionally configure verified Resend sender and OAuth clients. Register callback URLs on the provider side for the deployed origin. Consumer AI subscriptions do not supply an application API key.
4. Run `pnpm install --frozen-lockfile`, `pnpm db:migrate`, and `pnpm build`. Seed only deliberately: `pnpm db:seed` creates demo users and tickets. Do not run it on a public database unless those accounts are intended, secured, and their passwords have been rotated.
5. Start with `pnpm start` or the platform's Next.js runtime. Verify HTTPS, login, employee own-ticket scope, analyst claim/return, role restrictions, and persistent state after restart. Test a live model, OAuth, and email only after their real credentials are configured.

For Vercel, set the root to this repository, use the pnpm install command and Next.js framework preset, and use a managed external PostgreSQL service reachable from its functions. Run migrations in a controlled release step before serving new code. Check the platform's function duration and streaming limits for the chosen plan. Store all secrets in its environment settings; `.env.local` is ignored by Git.

The local Compose service is for development only. The repository contains no infrastructure credentials and cannot self-deploy without access to a host and database. If no hosting credentials are available, use the local setup in the README as the working demonstration.
