import { z } from 'zod';
import { getActor } from '@/modules/auth/actor';
import { getAnalystConversation } from '@/modules/handoffs/handoff-service';
import { errorResponse, resultResponse } from '@/lib/http';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (actor.error) {
    return resultResponse(actor);
  }

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return errorResponse({ code: 'VALIDATION_ERROR', message: 'Identificador inválido.' });
  }

  return resultResponse(
    await getAnalystConversation({ userId: actor.data.id, conversationId: id }),
  );
}
