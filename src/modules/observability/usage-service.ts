import { and, count, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { aiUsage } from '@/db/schema/app';
import { failure, success } from '@/lib/result';

export async function reserveAiRequest({
  actorId,
  conversationId,
  provider,
  model,
}: {
  actorId: string;
  conversationId: string;
  provider: string;
  model: string;
}) {
  const dailyLimit = Number(process.env.AI_DAILY_REQUEST_LIMIT ?? 100);
  const tokenLimit = Number(process.env.AI_DAILY_TOKEN_LIMIT ?? 100000);
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);

  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${actorId}))`);
      const [usage] = await tx
        .select({
          requests: count(),
          tokens: sql<number>`coalesce(sum(${aiUsage.inputTokens} + ${aiUsage.outputTokens}), 0)`,
        })
        .from(aiUsage)
        .where(and(eq(aiUsage.actorId, actorId), gte(aiUsage.createdAt, todayUtc)));

      if (usage.requests >= dailyLimit || Number(usage.tokens) >= tokenLimit) {
        return failure('RATE_LIMITED', 'O limite diário de uso da IA foi atingido.');
      }

      const [reservation] = await tx
        .insert(aiUsage)
        .values({
          actorId,
          conversationId,
          provider,
          model,
          status: 'started',
        })
        .returning({ id: aiUsage.id });

      return success(reservation.id);
    });
  } catch {
    return failure('AI_PROVIDER_UNAVAILABLE', 'Não foi possível reservar o uso da IA.');
  }
}

export async function finishAiRequest({
  usageId,
  status,
  inputTokens,
  outputTokens,
  latencyMs,
  priceInputPerMillion,
  priceOutputPerMillion,
}: {
  usageId: string;
  status: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  priceInputPerMillion?: number | null;
  priceOutputPerMillion?: number | null;
}) {
  const estimatedCostUsdMicros =
    inputTokens === null ||
    outputTokens === null ||
    priceInputPerMillion == null ||
    priceOutputPerMillion == null
      ? null
      : Math.round(
          (inputTokens * priceInputPerMillion + outputTokens * priceOutputPerMillion) / 1_000_000,
        );

  try {
    await db
      .update(aiUsage)
      .set({ status, inputTokens, outputTokens, latencyMs, estimatedCostUsdMicros })
      .where(eq(aiUsage.id, usageId));
  } catch {
    console.error('Failed to persist AI usage', { usageId });
  }
}
