import { count, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { aiUsage } from '@/db/schema/app';
import { getActor } from '@/modules/auth/actor';
import { requirePermission } from '@/modules/accessControl/permissions';
import { errorResponse, resultResponse } from '@/lib/http';

export async function GET() {
  const actor = await getActor();
  if (actor.error) {
    return resultResponse(actor);
  }

  const permitted = await requirePermission({
    userId: actor.data.id,
    permission: 'observability:read',
  });
  if (permitted.error) {
    return resultResponse(permitted);
  }

  try {
    const rows = await db
      .select({
        day: sql<string>`date(${aiUsage.createdAt} AT TIME ZONE 'America/Sao_Paulo')`,
        provider: aiUsage.provider,
        model: aiUsage.model,
        status: aiUsage.status,
        requests: count(),
        inputTokens: sql<number | null>`sum(${aiUsage.inputTokens})`,
        outputTokens: sql<number | null>`sum(${aiUsage.outputTokens})`,
        averageLatencyMs: sql<number | null>`avg(${aiUsage.latencyMs})`,
        estimatedCostUsdMicros: sql<number | null>`sum(${aiUsage.estimatedCostUsdMicros})`,
      })
      .from(aiUsage)
      .groupBy(
        sql`date(${aiUsage.createdAt} AT TIME ZONE 'America/Sao_Paulo')`,
        aiUsage.provider,
        aiUsage.model,
        aiUsage.status,
      )
      .orderBy(sql`date(${aiUsage.createdAt} AT TIME ZONE 'America/Sao_Paulo') DESC`)
      .limit(100);
    return resultResponse({ data: rows, error: null });
  } catch {
    return errorResponse({
      code: 'OBSERVABILITY_UNAVAILABLE',
      message: 'Não foi possível consultar o uso.',
    });
  }
}
