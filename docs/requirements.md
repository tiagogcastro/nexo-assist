# Product requirements and implementation status

| Area            | Delivered behavior                                                                          | Verification                                                  |
| --------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Identity        | Invite-only password accounts; optional OAuth, account linking and email integration        | Local sign-in, invitation and unauthorized sign-up HTTP flows |
| Employee chat   | Persistent sessions, Mastra streaming, 30-visible-message limit, human handoff              | Local handoff flow; live model requires provider key          |
| Tickets         | Own-ticket access, draft confirmation, duplicate handling, recent reopen, deterministic SLA | Local HTTP confirmation and replay checks; SLA unit tests     |
| Analyst console | Filtered queue, claim, reply, return and close with atomic state changes                    | Local two-analyst claim conflict and response flow            |
| Administration  | Users, invitations, dynamic roles, providers, usage, decisions and audit                    | Local admin HTTP and browser flows                            |
| Help center     | Eight seeded articles and PostgreSQL full-text search                                       | Seed and local app inspection                                 |
| Persistence     | PostgreSQL migrations and seeded data                                                       | Local migration, seed and restart                             |
| Design          | Six employee/analyst views and complementary admin screens                                  | Real browser screenshots in `docs/screenshots/`               |

External provider, OAuth, email and hosted deployment validation depend on credentials and infrastructure. See [README](../README.md) and [deployment](deployment.md). This status table describes observed behavior and does not imply those integrations were live-tested.
