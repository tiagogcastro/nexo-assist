import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  auditLogs,
  conversations,
  ticketDrafts,
  ticketEvents,
  ticketSequence,
  tickets,
} from '@/db/schema/app';
import { failure, success, type Result } from '@/lib/result';
import { requirePermission } from '@/modules/accessControl/permissions';
import { getSlaDeadline, classifyPriority } from '@/modules/tickets/sla';
import {
  createDraftSchema,
  ticketContentSchema,
  type CreateDraftInput,
} from '@/modules/tickets/ticket-schema';

const ACTIVE_STATUSES = ['open', 'awaiting_analyst', 'approved'];

function normalizeProblem(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function legacyAvailable(): boolean {
  return process.env.LEGACY_SIMULATE_OUTAGE !== 'true';
}

export async function listOwnTickets(userId: string) {
  const permission = await requirePermission({ userId, permission: 'tickets:read-own' });
  if (permission.error) {
    return permission;
  }

  if (!legacyAvailable()) {
    return failure(
      'LEGACY_SERVICE_UNAVAILABLE',
      'O serviço de chamados está temporariamente indisponível.',
    );
  }

  try {
    const rows = await db
      .select()
      .from(tickets)
      .where(eq(tickets.creatorId, userId))
      .orderBy(desc(tickets.createdAt));
    return success(rows);
  } catch {
    return failure('TICKET_SERVICE_UNAVAILABLE', 'Não foi possível consultar os chamados.');
  }
}

export async function createTicketDraft({
  userId,
  input,
}: {
  userId: string;
  input: CreateDraftInput;
}): Promise<
  Result<{
    id: string;
    action: string;
    ticketCode: string | null;
    priority: string;
    expiresAt: Date;
  }>
> {
  const permission = await requirePermission({ userId, permission: 'tickets:create-draft' });
  if (permission.error) {
    return permission;
  }

  const parsed = createDraftSchema.safeParse(input);
  if (!parsed.success) {
    return failure('VALIDATION_ERROR', 'Dados do chamado inválidos.');
  }

  if (!legacyAvailable()) {
    return failure(
      'LEGACY_SERVICE_UNAVAILABLE',
      'O serviço de chamados está temporariamente indisponível.',
    );
  }

  const { conversationId, ticketId, ...content } = parsed.data;
  const normalizedProblem = normalizeProblem(content.title);
  const priority = classifyPriority(content);

  try {
    const conversation = await db.query.conversations.findFirst({
      where: and(eq(conversations.id, conversationId), eq(conversations.employeeId, userId)),
    });

    if (!conversation || conversation.state !== 'agent_active') {
      return failure(
        'CONVERSATION_PAUSED',
        'Esta conversa não está disponível para criar rascunhos.',
      );
    }

    let existing = ticketId
      ? await db.query.tickets.findFirst({
          where: and(eq(tickets.id, ticketId), eq(tickets.creatorId, userId)),
        })
      : await db.query.tickets.findFirst({
          where: and(
            eq(tickets.creatorId, userId),
            eq(tickets.normalizedProblem, normalizedProblem),
          ),
          orderBy: desc(tickets.createdAt),
        });

    if (ticketId && !existing) {
      return failure('TICKET_NOT_FOUND', 'Chamado não encontrado.');
    }

    if (existing && !ACTIVE_STATUSES.includes(existing.status) && existing.status !== 'resolved') {
      existing = undefined;
    }

    const recentlyResolved =
      existing?.status === 'resolved' && existing.resolvedAt
        ? Date.now() - existing.resolvedAt.getTime() <= 7 * 24 * 60 * 60 * 1000
        : false;
    const action =
      existing && ACTIVE_STATUSES.includes(existing.status)
        ? 'update'
        : recentlyResolved
          ? 'reopen'
          : 'create';

    if (ticketId && action === 'create') {
      return failure('TICKET_NOT_FOUND', 'Este chamado não pode ser atualizado ou reaberto.');
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const [draft] = await db
      .insert(ticketDrafts)
      .values({
        conversationId,
        creatorId: userId,
        ticketId: action === 'create' ? null : existing?.id,
        action,
        payload: content,
        expiresAt,
      })
      .returning({ id: ticketDrafts.id });

    return success({
      id: draft.id,
      action,
      ticketCode: existing?.code ?? null,
      priority,
      expiresAt,
    });
  } catch {
    return failure('TICKET_SERVICE_UNAVAILABLE', 'Não foi possível preparar o chamado.');
  }
}

export async function listOwnTicketDrafts({
  userId,
  conversationId,
}: {
  userId: string;
  conversationId: string;
}) {
  const permitted = await requirePermission({ userId, permission: 'tickets:create-draft' });
  if (permitted.error) {
    return permitted;
  }

  try {
    const rows = await db
      .select()
      .from(ticketDrafts)
      .where(
        and(eq(ticketDrafts.creatorId, userId), eq(ticketDrafts.conversationId, conversationId)),
      )
      .orderBy(desc(ticketDrafts.createdAt));
    return success(
      rows.map((row) => {
        const parsed = ticketContentSchema.safeParse(row.payload);
        const priority = parsed.success ? classifyPriority(parsed.data) : null;
        return {
          ...row,
          priority,
          dueAt: priority ? getSlaDeadline({ from: row.createdAt, priority }) : null,
        };
      }),
    );
  } catch {
    return failure('TICKET_SERVICE_UNAVAILABLE', 'Não foi possível consultar os rascunhos.');
  }
}

export async function cancelTicketDraft({ userId, draftId }: { userId: string; draftId: string }) {
  const permitted = await requirePermission({ userId, permission: 'tickets:create-draft' });
  if (permitted.error) {
    return permitted;
  }

  try {
    const [canceled] = await db
      .update(ticketDrafts)
      .set({ expiresAt: new Date() })
      .where(and(eq(ticketDrafts.id, draftId), eq(ticketDrafts.creatorId, userId)))
      .returning({ id: ticketDrafts.id });
    return canceled ? success(canceled) : failure('DRAFT_NOT_FOUND', 'Rascunho não encontrado.');
  } catch {
    return failure('TICKET_SERVICE_UNAVAILABLE', 'Não foi possível cancelar o rascunho.');
  }
}

export async function confirmTicketDraft({
  userId,
  draftId,
  requestId,
}: {
  userId: string;
  draftId: string;
  requestId: string;
}): Promise<Result<{ id: string; code: string; action: string }>> {
  const permission = await requirePermission({ userId, permission: 'tickets:confirm-own' });
  if (permission.error) {
    return permission;
  }

  if (!legacyAvailable()) {
    return failure(
      'LEGACY_SERVICE_UNAVAILABLE',
      'O serviço de chamados está temporariamente indisponível.',
    );
  }

  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM ticket_drafts WHERE id = ${draftId} FOR UPDATE`);

      const draft = await tx.query.ticketDrafts.findFirst({
        where: and(eq(ticketDrafts.id, draftId), eq(ticketDrafts.creatorId, userId)),
      });

      if (!draft) {
        return failure('DRAFT_NOT_FOUND', 'Rascunho não encontrado.');
      }

      if (draft.consumedAt && draft.resultTicketId) {
        const saved = await tx.query.tickets.findFirst({
          where: eq(tickets.id, draft.resultTicketId),
        });
        if (saved) {
          return success({ id: saved.id, code: saved.code, action: draft.action });
        }
      }

      if (draft.expiresAt < new Date()) {
        return failure('DRAFT_EXPIRED', 'Este rascunho expirou. Prepare outro antes de confirmar.');
      }

      await tx.execute(
        sql`SELECT id FROM conversations WHERE id = ${draft.conversationId} FOR UPDATE`,
      );
      const conversation = await tx.query.conversations.findFirst({
        where: eq(conversations.id, draft.conversationId),
      });
      if (
        !conversation ||
        conversation.state !== 'agent_active' ||
        conversation.employeeId !== userId
      ) {
        return failure('CONVERSATION_PAUSED', 'A conversa foi transferida ou encerrada.');
      }

      const parsed = ticketContentSchema.safeParse(draft.payload);
      if (!parsed.success) {
        return failure('VALIDATION_ERROR', 'O rascunho não é válido.');
      }

      const content = parsed.data;
      const priority = classifyPriority(content);
      const normalizedProblem = normalizeProblem(content.title);

      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${userId} || ${normalizedProblem}))`,
      );

      let saved;
      if (draft.action === 'create') {
        const duplicate = await tx.query.tickets.findFirst({
          where: and(
            eq(tickets.creatorId, userId),
            eq(tickets.normalizedProblem, normalizedProblem),
            inArray(tickets.status, ACTIVE_STATUSES),
          ),
        });

        if (duplicate) {
          return failure('DUPLICATE_TICKET', 'Já existe um chamado aberto para este problema.');
        }

        const [sequence] = await tx
          .insert(ticketSequence)
          .values({})
          .returning({ id: ticketSequence.id });
        const code = `${content.type}-${String(sequence.id).padStart(5, '0')}`;
        const [created] = await tx
          .insert(tickets)
          .values({
            code,
            creatorId: userId,
            affectedUserId: userId,
            conversationId: draft.conversationId,
            type: content.type,
            category: content.category,
            priority,
            title: content.title,
            description: content.description,
            normalizedProblem,
            dueAt: getSlaDeadline({ from: new Date(), priority }),
          })
          .returning();
        saved = created;
      } else {
        const current = draft.ticketId
          ? await tx.query.tickets.findFirst({
              where: and(eq(tickets.id, draft.ticketId), eq(tickets.creatorId, userId)),
            })
          : undefined;

        if (!current) {
          return failure('TICKET_NOT_FOUND', 'Chamado não encontrado.');
        }

        if (draft.action === 'reopen') {
          if (
            current.status !== 'resolved' ||
            !current.resolvedAt ||
            Date.now() - current.resolvedAt.getTime() > 7 * 24 * 60 * 60 * 1000
          ) {
            return failure('DRAFT_EXPIRED', 'O prazo para reabrir o chamado terminou.');
          }
        } else if (!ACTIVE_STATUSES.includes(current.status)) {
          return failure('DRAFT_EXPIRED', 'Este chamado não está mais aberto.');
        }

        const [updated] = await tx
          .update(tickets)
          .set({
            description: `${current.description}\n\nAtualização: ${content.description}`,
            status: draft.action === 'reopen' ? 'open' : current.status,
            resolvedAt: draft.action === 'reopen' ? null : current.resolvedAt,
            priority,
            dueAt: getSlaDeadline({ from: new Date(), priority }),
            updatedAt: new Date(),
          })
          .where(eq(tickets.id, current.id))
          .returning();
        saved = updated;
      }

      await tx
        .insert(ticketEvents)
        .values({ ticketId: saved.id, actorId: userId, action: draft.action });
      await tx.insert(auditLogs).values({
        actorId: userId,
        action: `ticket.${draft.action}`,
        resourceType: 'ticket',
        resourceId: saved.id,
        requestId,
        outcome: 'committed',
      });
      await tx
        .update(ticketDrafts)
        .set({ consumedAt: new Date(), resultTicketId: saved.id })
        .where(eq(ticketDrafts.id, draft.id));

      return success({ id: saved.id, code: saved.code, action: draft.action });
    });
  } catch {
    return failure('TICKET_SERVICE_UNAVAILABLE', 'Não foi possível confirmar o chamado.');
  }
}
