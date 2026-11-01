import { z } from 'zod';
import { getActor } from '@/modules/auth/actor';
import { listProviderSettings, saveProvider } from '@/modules/aiProviders/provider-service';
import { errorResponse, readJson, resultResponse } from '@/lib/http';

const schema = z.object({
  kind: z.enum(['deepseek', 'openai', 'anthropic', 'openrouter']),
  name: z.string().trim().min(2).max(80),
  apiKey: z.string().trim().min(10),
  modelId: z.string().trim().min(2).max(120),
  priceInputUsd: z.number().finite().min(0).max(2000).optional(),
  priceOutputUsd: z.number().finite().min(0).max(2000).optional(),
});

export async function GET() {
  const actor = await getActor();
  if (actor.error) {
    return resultResponse(actor);
  }

  return resultResponse(await listProviderSettings(actor.data.id));
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
    return errorResponse({ code: 'VALIDATION_ERROR', message: 'Configuração inválida.' });
  }

  return resultResponse(
    await saveProvider({ userId: actor.data.id, ...parsed.data, requestId: crypto.randomUUID() }),
  );
}
