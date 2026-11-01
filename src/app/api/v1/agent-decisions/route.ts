import { and, desc, eq, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { agentDecisions, conversations } from '@/db/schema/app';
import { getActor } from '@/modules/auth/actor';
import { listUserPermissions } from '@/modules/accessControl/permissions';
import { errorResponse, resultResponse } from '@/lib/http';

export async function GET() {
  const actor = await getActor();
  if (actor.error) {
    return resultResponse(actor);
  }

  const permissions = await listUserPermissions(actor.data.id);
  if (!permissions.has('audit:read-all') && !permissions.has('conversations:read-queue')) {
    return errorResponse({ code: 'ACCESS_DENIED', message: 'Acesso não autorizado.' });
  }

  try {
    const base = db
      .select({
        id: agentDecisions.id,
        conversationId: agentDecisions.conversationId,
        intent: agentDecisions.intent,
        action: agentDecisions.action,
        evidence: agentDecisions.evidence,
        rationale: agentDecisions.rationale,
        confidence: agentDecisions.confidence,
        createdAt: agentDecisions.createdAt,
      })
      .from(agentDecisions)
      .innerJoin(conversations, eq(conversations.id, agentDecisions.conversationId));
    const rows = permissions.has('audit:read-all')
      ? await base.orderBy(desc(agentDecisions.createdAt)).limit(100)
      : await base
          .where(
            or(
              eq(conversations.state, 'awaiting_analyst'),
              and(
                eq(conversations.state, 'analyst_active'),
                eq(conversations.assignedAnalystId, actor.data.id),
              ),
            ),
          )
          .orderBy(desc(agentDecisions.createdAt))
          .limit(100);
    return resultResponse({ data: rows, error: null });
  } catch {
    return errorResponse({
      code: 'DECISIONS_UNAVAILABLE',
      message: 'Não foi possível consultar as decisões.',
    });
  }
}
