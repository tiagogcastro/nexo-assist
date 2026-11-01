import { z } from 'zod';
import { getActor } from '@/modules/auth/actor';
import { assignUserRole } from '@/modules/accessControl/role-service';
import { errorResponse, readJson, resultResponse } from '@/lib/http';

const schema = z.object({ userId: z.string().min(1), roleId: z.uuid(), assign: z.boolean() });

export async function POST(request: Request) {
  const actor = await getActor();
  if (actor.error) {
    return resultResponse(actor);
  }

  const body = await readJson(request);
  if (body.error) {
    return resultResponse(body);
  }

  const parsed = schema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse({ code: 'VALIDATION_ERROR', message: 'Vínculo inválido.' });
  }

  return resultResponse(
    await assignUserRole({
      actorId: actor.data.id,
      targetId: parsed.data.userId,
      roleId: parsed.data.roleId,
      assign: parsed.data.assign,
      requestId: crypto.randomUUID(),
    }),
  );
}
