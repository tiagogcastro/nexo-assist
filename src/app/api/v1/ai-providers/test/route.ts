import { z } from 'zod';
import { getActor } from '@/modules/auth/actor';
import { requirePermission } from '@/modules/accessControl/permissions';
import { testProviderConnection } from '@/modules/aiProviders/provider-service';
import { errorResponse, readJson, resultResponse } from '@/lib/http';

const schema = z.object({
  kind: z.enum(['deepseek', 'openai', 'anthropic', 'openrouter']),
  apiKey: z.string().min(10),
  modelId: z.string().min(2),
});

export async function POST(request: Request) {
  const actor = await getActor();
  if (actor.error) {
    return resultResponse(actor);
  }

  const permitted = await requirePermission({
    userId: actor.data.id,
    permission: 'providers:manage',
  });
  if (permitted.error) {
    return resultResponse(permitted);
  }

  const body = await readJson(request);
  if (body.error) {
    return resultResponse(body);
  }

  const parsed = schema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse({ code: 'VALIDATION_ERROR', message: 'Configuração inválida.' });
  }

  return resultResponse(await testProviderConnection(parsed.data));
}
