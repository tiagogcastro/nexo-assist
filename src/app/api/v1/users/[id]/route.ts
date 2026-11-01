import { z } from 'zod';
import { getActor } from '@/modules/auth/actor';
import { setUserActive } from '@/modules/users/user-service';
import { errorResponse, readJson, resultResponse } from '@/lib/http';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (actor.error) {
    return resultResponse(actor);
  }

  const { id } = await params;
  const body = await readJson(request);
  if (body.error) {
    return resultResponse(body);
  }

  const parsed = z.object({ active: z.boolean() }).safeParse(body.data);
  if (!id || !parsed.success) {
    return errorResponse({ code: 'VALIDATION_ERROR', message: 'Dados inválidos.' });
  }

  return resultResponse(
    await setUserActive({
      actorId: actor.data.id,
      targetId: id,
      active: parsed.data.active,
      requestId: crypto.randomUUID(),
    }),
  );
}
