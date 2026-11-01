import { z } from 'zod';
import { getActor } from '@/modules/auth/actor';
import { searchHelpArticles } from '@/modules/helpCenter/help-service';
import { errorResponse, resultResponse } from '@/lib/http';

export async function GET(request: Request) {
  const actor = await getActor();
  if (actor.error) {
    return resultResponse(actor);
  }

  const query = new URL(request.url).searchParams.get('q');
  const parsed = z.string().min(1).max(200).safeParse(query);
  if (!parsed.success) {
    return errorResponse({ code: 'VALIDATION_ERROR', message: 'Informe uma busca válida.' });
  }

  return resultResponse(await searchHelpArticles(parsed.data));
}
