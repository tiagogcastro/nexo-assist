import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { permissions, rolePermissions, roles, userRoles } from '@/db/schema/app';
import { failure, success, type Result } from '@/lib/result';

export const PERMISSION_KEYS = [
  'tickets:read-own',
  'tickets:read-assigned',
  'tickets:create-draft',
  'tickets:confirm-own',
  'tickets:update-assigned',
  'conversations:read-own',
  'conversations:read-queue',
  'conversations:claim',
  'conversations:respond-assigned',
  'conversations:handoff-own',
  'users:manage',
  'roles:manage',
  'providers:manage',
  'observability:read',
  'audit:read-all',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export async function listUserPermissions(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ key: permissions.key })
    .from(userRoles)
    .innerJoin(roles, and(eq(userRoles.roleId, roles.id), eq(roles.active, true)))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(permissions.key, rolePermissions.permissionKey))
    .where(eq(userRoles.userId, userId));

  return new Set(rows.map((row) => row.key));
}

export async function requirePermission({
  userId,
  permission,
}: {
  userId: string;
  permission: PermissionKey;
}): Promise<Result<{ userId: string }>> {
  const granted = await listUserPermissions(userId);

  if (!granted.has(permission)) {
    return failure('ACCESS_DENIED', 'Acesso não autorizado.');
  }

  return success({ userId });
}
