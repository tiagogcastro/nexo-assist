import { getActor } from '@/modules/auth/actor';
import { createTicketDraft, listOwnTicketDrafts } from '@/modules/tickets/ticket-service';
import { createDraftSchema } from '@/modules/tickets/ticket-schema';
import { errorResponse, readJson, resultResponse } from '@/lib/http';
import { z } from 'zod';

export async function GET(request: Request) {
  const actor = await getActor();
  if (actor.error) {
    return resultResponse(actor);
  }

  const conversationId = new URL(request.url).searchParams.get('conversationId');
  if (!z.uuid().safeParse(conversationId).success) {
    return errorResponse({ code: 'VALIDATION_ERROR', message: 'Conversa inválida.' });
  }

  return resultResponse(
    await listOwnTicketDrafts({ userId: actor.data.id, conversationId: conversationId ?? '' }),
  );
}

export async function POST(request: Request) {
  const actor = await getActor();
  if (actor.error) {
    return resultResponse(actor);
  }

  const body = await readJson(request);
  if (body.error) {
    return resultResponse(body);
  }

  const parsed = createDraftSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse({ code: 'VALIDATION_ERROR', message: 'Dados do rascunho inválidos.' });
  }

  return resultResponse(await createTicketDraft({ userId: actor.data.id, input: parsed.data }));
}
