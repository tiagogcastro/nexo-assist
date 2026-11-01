import { z } from 'zod';
import { getActor } from '@/modules/auth/actor';
import { PERMISSION_KEYS } from '@/modules/accessControl/permissions';
import { updateRole } from '@/modules/accessControl/role-service';
import { errorResponse, readJson, resultResponse } from '@/lib/http';

const schema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300),
  active: z.boolean(),
  permissionKeys: z.array(z.enum(PERMISSION_KEYS)),
});

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

  const parsed = schema.safeParse(body.data);
  if (!z.uuid().safeParse(id).success || !parsed.success) {
    return errorResponse({ code: 'VALIDATION_ERROR', message: 'Perfil inválido.' });
  }

  return resultResponse(
    await updateRole({
      actorId: actor.data.id,
      roleId: id,
      ...parsed.data,
      requestId: crypto.randomUUID(),
    }),
  );
}
