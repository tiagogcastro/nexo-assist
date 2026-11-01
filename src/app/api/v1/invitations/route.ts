import { z } from 'zod';
import { getActor } from '@/modules/auth/actor';
import { createInvitation } from '@/modules/users/user-service';
import { errorResponse, readJson, resultResponse } from '@/lib/http';

export async function POST(request: Request) {
  const actor = await getActor();
  if (actor.error) {
    return resultResponse(actor);
  }

  const body = await readJson(request);
  if (body.error) {
    return resultResponse(body);
  }

  const parsed = z.object({ email: z.email() }).safeParse(body.data);
  if (!parsed.success) {
    return errorResponse({ code: 'VALIDATION_ERROR', message: 'E-mail inválido.' });
  }

  return resultResponse(
    await createInvitation({
      actorId: actor.data.id,
      email: parsed.data.email,
      requestId: crypto.randomUUID(),
    }),
  );
}
