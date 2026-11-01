import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { conversations, messages } from '@/db/schema/app';
import { failure, success } from '@/lib/result';
import { requirePermission } from '@/modules/accessControl/permissions';

export async function createConversation(userId: string) {
  const permitted = await requirePermission({ userId, permission: 'conversations:read-own' });
  if (permitted.error) {
    return permitted;
  }

  try {
    const [created] = await db.insert(conversations).values({ employeeId: userId }).returning();
    return success(created);
  } catch {
    return failure('CONVERSATION_UNAVAILABLE', 'Não foi possível iniciar a conversa.');
  }
}

export async function listOwnConversations(userId: string) {
  const permitted = await requirePermission({ userId, permission: 'conversations:read-own' });
  if (permitted.error) {
    return permitted;
  }

  try {
    const rows = await db
      .select()
      .from(conversations)
      .where(eq(conversations.employeeId, userId))
      .orderBy(desc(conversations.updatedAt));
    return success(rows);
  } catch {
    return failure('CONVERSATION_UNAVAILABLE', 'Não foi possível consultar o histórico.');
  }
}

export async function getOwnConversation({
  userId,
  conversationId,
}: {
  userId: string;
  conversationId: string;
}) {
  const permitted = await requirePermission({ userId, permission: 'conversations:read-own' });
  if (permitted.error) {
    return permitted;
  }

  try {
    const conversation = await db.query.conversations.findFirst({
      where: and(eq(conversations.id, conversationId), eq(conversations.employeeId, userId)),
    });
    if (!conversation) {
      return failure('CONVERSATION_NOT_FOUND', 'Conversa não encontrada.');
    }

    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
    return success({ conversation, messages: history });
  } catch {
    return failure('CONVERSATION_UNAVAILABLE', 'Não foi possível consultar a conversa.');
  }
}

export async function appendEmployeeMessage({
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
  const permitted = await requirePermission({ userId, permission: 'conversations:read-own' });
  if (permitted.error) {
    return permitted;
  }

  try {
    return await db.transaction(async (tx) => {
      const existing = await tx.query.messages.findFirst({
        where: and(
          eq(messages.conversationId, conversationId),
          eq(messages.requestKey, requestKey),
        ),
      });
      if (existing) {
        return success({ message: existing, repeated: true });
      }

      const [updated] = await tx
        .update(conversations)
        .set({
          messageCount: sql`${conversations.messageCount} + 1`,
          version: sql`${conversations.version} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.employeeId, userId),
            eq(conversations.state, 'agent_active'),
            sql`${conversations.messageCount} <= 28`,
          ),
        )
        .returning();

      if (!updated) {
        return failure(
          'CONVERSATION_LIMIT',
          'Esta sessão atingiu o limite ou foi transferida. Inicie outra conversa.',
        );
      }

      const [message] = await tx
        .insert(messages)
        .values({ conversationId, authorId: userId, role: 'employee', content, requestKey })
        .returning();
      return success({ message, repeated: false });
    });
  } catch {
    return failure('CONVERSATION_UNAVAILABLE', 'Não foi possível enviar a mensagem.');
  }
}

export async function appendAgentMessage({
  conversationId,
  content,
  requestKey,
}: {
  conversationId: string;
  content: string;
  requestKey: string;
}) {
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM conversations WHERE id = ${conversationId} FOR UPDATE`);

      const conversation = await tx.query.conversations.findFirst({
        where: eq(conversations.id, conversationId),
      });
      if (!conversation || conversation.state !== 'agent_active') {
        return failure('CONVERSATION_PAUSED', 'O assistente foi pausado para atendimento humano.');
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

      await tx
        .update(conversations)
        .set({ messageCount: conversation.messageCount + 1, updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));
      const [message] = await tx
        .insert(messages)
        .values({ conversationId, role: 'agent', content, requestKey })
        .returning();
      return success(message);
    });
  } catch {
    return failure('CONVERSATION_UNAVAILABLE', 'Não foi possível salvar a resposta.');
  }
}
