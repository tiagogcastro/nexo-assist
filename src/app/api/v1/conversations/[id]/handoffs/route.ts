import { z } from 'zod';
import { getActor } from '@/modules/auth/actor';
import { requestHandoff } from '@/modules/handoffs/handoff-service';
import { errorResponse, readJson, resultResponse } from '@/lib/http';

const schema = z.object({ summary: z.string().trim().min(1).max(1000) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    return errorResponse({
      code: 'VALIDATION_ERROR',
      message: 'Dados de transferência inválidos.',
    });
  }

  return resultResponse(
    await requestHandoff({
      userId: actor.data.id,
      conversationId: id,
      summary: parsed.data.summary,
      requestId: crypto.randomUUID(),
    }),
  );
}
