# Business rules

## Tickets and service levels

An incident (`INC`) is something broken; a request (`REQ`) asks for access, equipment, or software. A ticket stores title, description, type, category, impact, urgency, priority, affected employee, creator, status, timestamps, and service-level deadlines. The employee must confirm a validated draft before any create, update, or reopen mutation. Repeating a confirmation returns the same ticket. A canceled draft changes no ticket.

The service checks for an open ticket by the same creator and problem before creating a new one. A resolved ticket can be reopened only within seven calendar days and after confirmation. Ticket codes are unique and generated safely under concurrent requests. Employees see only tickets they opened.

Priority follows impact and urgency: critical for team/company outage (one clock hour, 24/7), high for a blocked individual or same-day need (four business hours), medium for a workaround (three business days), and low for improvements without urgency (five business days). Business time is Monday–Friday, 08:00–18:00 in `America/Sao_Paulo`, with no holiday calendar. PostgreSQL stores UTC instants. First-response and update deadlines are calculated by the same deterministic service; overdue status is shown separately from ticket status.

## Conversation and handoff

A session allows at most 30 visible employee, agent, and analyst messages. Internal actions and streaming chunks do not count. The server enforces the cap atomically. Employees may start another session. A human request changes the conversation to `awaiting_analyst`, immediately pausing agent writes. An analyst can claim it, reply, return it to the agent, or close it. Transitions are conditional database writes; two analysts cannot both claim the same conversation.

The assistant can search approved help articles and the actor's own tickets, prepare a draft, and request handoff. Retrieved content is data, never instructions. It cannot confirm a ticket change. Critical, overdue, uncertain, or explicitly requested cases should go to a human. Non-IT requests are redirected. When the legacy ticket service is simulated as unavailable, mutations fail without inventing a ticket ID or silently retrying a non-idempotent write.
