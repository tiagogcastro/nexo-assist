import { z } from 'zod';
import { getActor } from '@/modules/auth/actor';
import { confirmTicketDraft } from '@/modules/tickets/ticket-service';
import { errorResponse, resultResponse } from '@/lib/http';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (actor.error) {
    return resultResponse(actor);
  }

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return errorResponse({ code: 'VALIDATION_ERROR', message: 'Identificador inválido.' });
  }

  return resultResponse(
    await confirmTicketDraft({
      userId: actor.data.id,
      draftId: id,
      requestId: crypto.randomUUID(),
    }),
  );
}
