import { and, desc, eq, or, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { auditLogs, conversations, handoffs, messages, tickets } from '@/db/schema/app';
import { user } from '@/db/schema/auth';
import { failure, success } from '@/lib/result';
import { requirePermission } from '@/modules/accessControl/permissions';

export async function requestHandoff({
  userId,
  conversationId,
  summary,
  requestId,
}: {
  userId: string;
  conversationId: string;
  summary: string;
  requestId: string;
}) {
  const permitted = await requirePermission({ userId, permission: 'conversations:handoff-own' });
  if (permitted.error) {
    return permitted;
  }

  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM conversations WHERE id = ${conversationId} FOR UPDATE`);
      const conversation = await tx.query.conversations.findFirst({
        where: and(eq(conversations.id, conversationId), eq(conversations.employeeId, userId)),
      });

      if (!conversation) {
        return failure('CONVERSATION_NOT_FOUND', 'Conversa não encontrada.');
      }

      if (conversation.state !== 'agent_active') {
        return failure('CONVERSATION_PAUSED', 'Esta conversa já está com atendimento humano.');
      }

      const [handoff] = await tx
        .insert(handoffs)
        .values({
          conversationId,
          requestedBy: userId,
          summary: summary.slice(0, 1000),
        })
        .returning();
      const messageAdded = conversation.messageCount < 30;
      if (messageAdded) {
        await tx.insert(messages).values({
          conversationId,
          authorId: userId,
          role: 'employee',
          content: summary.slice(0, 1000),
        });
      }
      await tx
        .update(conversations)
        .set({
          state: 'awaiting_analyst',
          messageCount: conversation.messageCount + (messageAdded ? 1 : 0),
          version: conversation.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, conversationId));
      await tx.insert(auditLogs).values({
        actorId: userId,
        action: 'handoff.request',
        resourceType: 'conversation',
        resourceId: conversationId,
        requestId,
        outcome: 'committed',
      });

      return success(handoff);
    });
  } catch {
    return failure('HANDOFF_UNAVAILABLE', 'Não foi possível solicitar atendimento humano.');
  }
}

export async function listAnalystQueue(userId: string) {
  const permitted = await requirePermission({ userId, permission: 'conversations:read-queue' });
  if (permitted.error) {
    return permitted;
  }

  try {
    const rows = await db
      .select({
        id: conversations.id,
        employeeId: conversations.employeeId,
        employeeName: user.name,
        title: conversations.title,
        state: conversations.state,
        assignedAnalystId: conversations.assignedAnalystId,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .innerJoin(user, eq(user.id, conversations.employeeId))
      .where(
        or(
          eq(conversations.state, 'awaiting_analyst'),
          and(
            eq(conversations.state, 'analyst_active'),
            eq(conversations.assignedAnalystId, userId),
          ),
        ),
      )
      .orderBy(desc(conversations.updatedAt));

    return success(rows);
  } catch {
    return failure('HANDOFF_UNAVAILABLE', 'Não foi possível consultar a fila.');
  }
}

export async function getAnalystConversation({
  userId,
  conversationId,
}: {
  userId: string;
  conversationId: string;
}) {
  const permitted = await requirePermission({ userId, permission: 'conversations:read-queue' });
  if (permitted.error) {
    return permitted;
  }

  try {
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });
    if (
      !conversation ||
      (conversation.state !== 'awaiting_analyst' && conversation.assignedAnalystId !== userId)
    ) {
      return failure('CONVERSATION_NOT_FOUND', 'Conversa não encontrada nesta fila.');
    }

    const employee = await db.query.user.findFirst({ where: eq(user.id, conversation.employeeId) });
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
    const employeeTickets = await db
      .select()
      .from(tickets)
      .where(eq(tickets.creatorId, conversation.employeeId))
      .orderBy(desc(tickets.createdAt));
    const handoff = await db.query.handoffs.findFirst({
      where: eq(handoffs.conversationId, conversationId),
      orderBy: desc(handoffs.createdAt),
    });
    return success({
      conversation: { ...conversation, employeeName: employee?.name ?? 'Funcionário' },
      messages: history,
      tickets: employeeTickets,
      handoff,
    });
  } catch {
    return failure('HANDOFF_UNAVAILABLE', 'Não foi possível consultar a conversa.');
  }
}

export async function transitionHandoff({
  userId,
  handoffId,
  action,
  requestId,
}: {
  userId: string;
  handoffId: string;
  action: 'claim' | 'return' | 'close';
  requestId: string;
}) {
  const permitted = await requirePermission({ userId, permission: 'conversations:claim' });
  if (permitted.error) {
    return permitted;
  }

  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM handoffs WHERE id = ${handoffId} FOR UPDATE`);
      const handoff = await tx.query.handoffs.findFirst({ where: eq(handoffs.id, handoffId) });
      if (!handoff) {
        return failure('HANDOFF_NOT_FOUND', 'Transferência não encontrada.');
      }

      await tx.execute(
        sql`SELECT id FROM conversations WHERE id = ${handoff.conversationId} FOR UPDATE`,
      );
      const conversation = await tx.query.conversations.findFirst({
        where: eq(conversations.id, handoff.conversationId),
      });
      if (!conversation) {
        return failure('CONVERSATION_NOT_FOUND', 'Conversa não encontrada.');
      }

      if (action === 'claim') {
        if (handoff.state !== 'pending' || conversation.state !== 'awaiting_analyst') {
          return failure('CONVERSATION_PAUSED', 'Outro analista já assumiu esta conversa.');
        }

        await tx
          .update(handoffs)
          .set({ state: 'claimed', claimedBy: userId, claimedAt: new Date() })
          .where(eq(handoffs.id, handoffId));
        await tx
          .update(conversations)
          .set({
            state: 'analyst_active',
            assignedAnalystId: userId,
            version: conversation.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, conversation.id));
      } else {
        if (
          handoff.state !== 'claimed' ||
          handoff.claimedBy !== userId ||
          conversation.state !== 'analyst_active'
        ) {
          return failure('ACCESS_DENIED', 'Esta conversa não está sob seu atendimento.');
        }

        await tx
          .update(handoffs)
          .set({ state: action === 'return' ? 'returned' : 'closed', closedAt: new Date() })
          .where(eq(handoffs.id, handoffId));
        await tx
          .update(conversations)
          .set({
            state: action === 'return' ? 'agent_active' : 'closed',
            assignedAnalystId: null,
            version: conversation.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, conversation.id));
      }

      await tx.insert(auditLogs).values({
        actorId: userId,
        action: `handoff.${action}`,
        resourceType: 'handoff',
        resourceId: handoffId,
        requestId,
        outcome: 'committed',
      });
      return success({ id: handoffId, state: action });
    });
  } catch {
    return failure('HANDOFF_UNAVAILABLE', 'Não foi possível atualizar o atendimento.');
  }
}

export async function appendAnalystMessage({
  userId,
  conversationId,
  content,
  requestKey,
}: {
  userId: string;
  conversationId: string;
  content: string;
  requestKey: string;
}) {
  const permitted = await requirePermission({
    userId,
    permission: 'conversations:respond-assigned',
  });
  if (permitted.error) {
    return permitted;
  }

  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM conversations WHERE id = ${conversationId} FOR UPDATE`);
      const conversation = await tx.query.conversations.findFirst({
        where: eq(conversations.id, conversationId),
      });
      if (
        !conversation ||
        conversation.state !== 'analyst_active' ||
        conversation.assignedAnalystId !== userId
      ) {
        return failure('ACCESS_DENIED', 'Esta conversa não está sob seu atendimento.');
      }

      const existing = await tx.query.messages.findFirst({
        where: and(
          eq(messages.conversationId, conversationId),
          eq(messages.requestKey, requestKey),
        ),
      });
      if (existing) {
        return success(existing);
      }

      if (conversation.messageCount >= 30) {
        return failure('CONVERSATION_LIMIT', 'Esta sessão atingiu o limite de mensagens.');
      }

      const [message] = await tx
        .insert(messages)
        .values({ conversationId, authorId: userId, role: 'analyst', content, requestKey })
        .returning();
      await tx
        .update(conversations)
        .set({ messageCount: conversation.messageCount + 1, updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));
      return success(message);
    });
  } catch {
    return failure('HANDOFF_UNAVAILABLE', 'Não foi possível enviar a mensagem.');
  }
}
