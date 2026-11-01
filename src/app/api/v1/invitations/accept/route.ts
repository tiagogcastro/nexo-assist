import { z } from 'zod';
import { acceptInvitation } from '@/modules/users/user-service';
import { errorResponse, readJson, resultResponse } from '@/lib/http';

const schema = z.object({
  email: z.email(),
  token: z.string().min(32),
  name: z.string().trim().min(2),
  password: z.string().min(12),
});

export async function POST(request: Request) {
  const body = await readJson(request);
  if (body.error) {
    return resultResponse(body);
  }

  const parsed = schema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse({ code: 'VALIDATION_ERROR', message: 'Convite ou senha inválidos.' });
  }

  return resultResponse(await acceptInvitation(parsed.data));
}
