import { z } from 'zod';
import { getActor } from '@/modules/auth/actor';
import { transitionHandoff } from '@/modules/handoffs/handoff-service';
import { errorResponse, resultResponse } from '@/lib/http';

const actionSchema = z.enum(['claim', 'return', 'close']);

export async function POST(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; action: string }>;
  },
) {
  const actor = await getActor();
  if (actor.error) {
    return resultResponse(actor);
  }

  const { id, action } = await params;
  const parsed = actionSchema.safeParse(action);
  if (!z.uuid().safeParse(id).success || !parsed.success) {
    return errorResponse({ code: 'VALIDATION_ERROR', message: 'Ação inválida.' });
  }

  return resultResponse(
    await transitionHandoff({
      userId: actor.data.id,
      handoffId: id,
      action: parsed.data,
      requestId: crypto.randomUUID(),
    }),
  );
}
