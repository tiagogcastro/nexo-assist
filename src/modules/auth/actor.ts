import { headers } from 'next/headers';
import { auth } from '@/modules/auth/auth';
import { db } from '@/db/client';
import { user } from '@/db/schema/auth';
import { eq } from 'drizzle-orm';
import { failure, success, type Result } from '@/lib/result';

export type Actor = { id: string; email: string; name: string };

export async function getActor(): Promise<Result<Actor>> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return failure('UNAUTHENTICATED', 'Entre na sua conta para continuar.');
    }

    const currentUser = await db.query.user.findFirst({
      where: eq(user.id, session.user.id),
      columns: { active: true },
    });
    if (!currentUser?.active) {
      return failure('ACCESS_DENIED', 'Esta conta está desativada.');
    }

    return success({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    });
  } catch {
    return failure('AUTH_UNAVAILABLE', 'Não foi possível verificar sua sessão.');
  }
}
