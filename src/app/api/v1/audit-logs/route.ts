import { desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { auditLogs } from '@/db/schema/app';
import { getActor } from '@/modules/auth/actor';
import { requirePermission } from '@/modules/accessControl/permissions';
import { errorResponse, resultResponse } from '@/lib/http';

export async function GET() {
  const actor = await getActor();
  if (actor.error) {
    return resultResponse(actor);
  }

  const permitted = await requirePermission({
    userId: actor.data.id,
    permission: 'audit:read-all',
  });
  if (permitted.error) {
    return resultResponse(permitted);
  }

  try {
    const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
    return resultResponse({ data: rows, error: null });
  } catch {
    return errorResponse({
      code: 'AUDIT_UNAVAILABLE',
      message: 'Não foi possível consultar a auditoria.',
    });
  }
}
