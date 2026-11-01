import { z } from 'zod';
import { getActor } from '@/modules/auth/actor';
import { PERMISSION_KEYS } from '@/modules/accessControl/permissions';
import { createRole, listRoles } from '@/modules/accessControl/role-service';
import { errorResponse, readJson, resultResponse } from '@/lib/http';

const schema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300),
  permissionKeys: z.array(z.enum(PERMISSION_KEYS)),
});

export async function GET() {
  const actor = await getActor();
  if (actor.error) {
    return resultResponse(actor);
  }

  return resultResponse(await listRoles(actor.data.id));
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

  const parsed = schema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse({ code: 'VALIDATION_ERROR', message: 'Perfil inválido.' });
  }

  return resultResponse(
    await createRole({ actorId: actor.data.id, ...parsed.data, requestId: crypto.randomUUID() }),
  );
}
