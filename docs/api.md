# Versioned API contracts

All domain endpoints are under `/api/v1`; Better Auth uses `/api/auth/*`. Requests use the authenticated session cookie. JSON responses use `{ data, error: null }` on success or `{ data: null, error: { code, message } }` on failure. Invalid input is rejected with a suitable HTTP status. The server derives actor identity and authorization; client-supplied IDs never grant access.

| Endpoint                                                              | Purpose                                                                                |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `GET/POST /conversations`                                             | List own sessions / start a session                                                    |
| `GET /conversations/:id`                                              | Own session and messages                                                               |
| `POST /conversations/:id/messages`                                    | Send `{ content, requestKey }` and stream `action`, `delta`, `done`, or `error` events |
| `POST /conversations/:id/handoffs`                                    | Request human handoff with a summary                                                   |
| `GET /tickets`                                                        | Tickets opened by the actor                                                            |
| `GET/POST /ticket-drafts`                                             | List own drafts / prepare a validated create, update, or reopen draft                  |
| `GET/DELETE /ticket-drafts/:id`                                       | Read or cancel own draft                                                               |
| `POST /ticket-drafts/:id/confirm`                                     | Idempotent confirmed ticket write                                                      |
| `GET /help-articles?q=...`                                            | Search approved articles                                                               |
| `GET /analyst/conversations`                                          | Authorized analyst queue                                                               |
| `GET /analyst/conversations/:id`                                      | Authorized detail and ticket context                                                   |
| `POST /analyst/conversations/:id/messages`                            | Reply to an assigned conversation                                                      |
| `POST /handoffs/:id/:action`                                          | Atomic `claim`, `return`, or `close` transition                                        |
| `GET/POST /invitations`, `POST /invitations/accept`                   | Admin invite and protected acceptance                                                  |
| `GET /users`, `PATCH /users/:id`                                      | Admin user management                                                                  |
| `GET/POST /roles`, `PATCH /roles/:id`, `POST /user-roles`             | Dynamic roles and membership                                                           |
| `GET/POST /ai-providers`, `POST /ai-providers/test`                   | Provider settings and real connection test                                             |
| `DELETE /ai-providers/:id`                                            | Remove a stored credential and its models                                              |
| `GET /observability/usage`, `GET /agent-decisions`, `GET /audit-logs` | Permission-scoped operational views                                                    |

Ticket mutations are intentionally absent from direct `PATCH /tickets/:id`: the draft confirmation endpoint is the only browser path for employee writes. A repeated confirmation returns its existing result. AI tools share these domain rules and cannot confirm drafts.
