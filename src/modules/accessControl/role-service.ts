import { and, count, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { auditLogs, permissions, rolePermissions, roles, userRoles } from '@/db/schema/app';
import { user } from '@/db/schema/auth';
import { failure, success } from '@/lib/result';
import {
  listUserPermissions,
  requirePermission,
  type PermissionKey,
} from '@/modules/accessControl/permissions';

export async function listRoles(actorId: string) {
  const permitted = await requirePermission({ userId: actorId, permission: 'roles:manage' });
  if (permitted.error) {
    return permitted;
  }

  try {
    const roleRows = await db.select().from(roles).orderBy(roles.name);
    const links = await db.select().from(rolePermissions);
    return success({
      roles: roleRows.map((role) => ({
        ...role,
        permissions: links
          .filter((link) => link.roleId === role.id)
          .map((link) => link.permissionKey),
      })),
      catalog: await db.select().from(permissions).orderBy(permissions.key),
    });
  } catch {
    return failure('ROLES_UNAVAILABLE', 'Não foi possível consultar os perfis.');
  }
}

async function validateGrant(actorId: string, requested: PermissionKey[]) {
  const actorPermissions = await listUserPermissions(actorId);
  return requested.every((permission) => actorPermissions.has(permission));
}

export async function createRole({
  actorId,
  name,
  description,
  permissionKeys,
  requestId,
}: {
  actorId: string;
  name: string;
  description: string;
  permissionKeys: PermissionKey[];
  requestId: string;
}) {
  const permitted = await requirePermission({ userId: actorId, permission: 'roles:manage' });
  if (permitted.error) {
    return permitted;
  }

  if (!(await validateGrant(actorId, permissionKeys))) {
    return failure('ACCESS_DENIED', 'Você não pode conceder permissões que não possui.');
  }

  try {
    return await db.transaction(async (tx) => {
      const [role] = await tx.insert(roles).values({ name, description }).returning();
      if (permissionKeys.length) {
        await tx
          .insert(rolePermissions)
          .values(permissionKeys.map((permissionKey) => ({ roleId: role.id, permissionKey })));
      }
      await tx.insert(auditLogs).values({
        actorId,
        action: 'role.create',
        resourceType: 'role',
        resourceId: role.id,
        requestId,
        outcome: 'committed',
      });
      return success(role);
    });
  } catch {
    return failure('ROLES_UNAVAILABLE', 'Não foi possível criar o perfil.');
  }
}

export async function updateRole({
  actorId,
  roleId,
  name,
  description,
  active,
  permissionKeys,
  requestId,
}: {
  actorId: string;
  roleId: string;
  name: string;
  description: string;
  active: boolean;
  permissionKeys: PermissionKey[];
  requestId: string;
}) {
  const permitted = await requirePermission({ userId: actorId, permission: 'roles:manage' });
  if (permitted.error) {
    return permitted;
  }

  if (!(await validateGrant(actorId, permissionKeys))) {
    return failure('ACCESS_DENIED', 'Você não pode conceder permissões que não possui.');
  }

  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM roles WHERE id = ${roleId} FOR UPDATE`);
      const current = await tx.query.roles.findFirst({ where: eq(roles.id, roleId) });
      if (!current) {
        return failure('ROLE_NOT_FOUND', 'Perfil não encontrado.');
      }

      if (current.protected) {
        return failure('ACCESS_DENIED', 'Perfis básicos são protegidos contra edição.');
      }

      const [updated] = await tx
        .update(roles)
        .set({ name, description, active })
        .where(eq(roles.id, roleId))
        .returning();
      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
      if (permissionKeys.length) {
        await tx
          .insert(rolePermissions)
          .values(permissionKeys.map((permissionKey) => ({ roleId, permissionKey })));
      }
      await tx.insert(auditLogs).values({
        actorId,
        action: 'role.update',
        resourceType: 'role',
        resourceId: roleId,
        requestId,
        outcome: 'committed',
      });
      return success(updated);
    });
  } catch {
    return failure('ROLES_UNAVAILABLE', 'Não foi possível atualizar o perfil.');
  }
}

export async function assignUserRole({
  actorId,
  targetId,
  roleId,
  assign,
  requestId,
}: {
  actorId: string;
  targetId: string;
  roleId: string;
  assign: boolean;
  requestId: string;
}) {
  const permitted = await requirePermission({ userId: actorId, permission: 'roles:manage' });
  if (permitted.error) {
    return permitted;
  }

  if (actorId === targetId) {
    return failure('ACCESS_DENIED', 'Você não pode alterar os próprios perfis.');
  }

  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(1001)`);
      const target = await tx.query.user.findFirst({ where: eq(user.id, targetId) });
      const role = await tx.query.roles.findFirst({ where: eq(roles.id, roleId) });
      if (!target || !role || !role.active) {
        return failure('ROLE_NOT_FOUND', 'Usuário ou perfil não encontrado.');
      }

      const grants = await tx
        .select({ key: rolePermissions.permissionKey })
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, roleId));
      const actorPermissions = await listUserPermissions(actorId);
      if (grants.some((grant) => !actorPermissions.has(grant.key))) {
        return failure(
          'ACCESS_DENIED',
          'Você não pode atribuir um perfil com permissões que não possui.',
        );
      }

      if (assign) {
        await tx.insert(userRoles).values({ userId: targetId, roleId }).onConflictDoNothing();
      } else {
        if (role.name === 'admin') {
          const [admins] = await tx
            .select({ total: count() })
            .from(userRoles)
            .innerJoin(user, eq(user.id, userRoles.userId))
            .where(and(eq(userRoles.roleId, roleId), eq(user.active, true)));
          if (admins.total <= 1) {
            return failure('LAST_ADMIN', 'Não é possível remover o último administrador.');
          }
        }

        await tx
          .delete(userRoles)
          .where(and(eq(userRoles.userId, targetId), eq(userRoles.roleId, roleId)));
      }

      await tx.insert(auditLogs).values({
        actorId,
        action: assign ? 'role.assign' : 'role.unassign',
        resourceType: 'user',
        resourceId: targetId,
        requestId,
        outcome: 'committed',
        metadata: { roleId },
      });
      return success({ userId: targetId, roleId, assigned: assign });
    });
  } catch {
    return failure('ROLES_UNAVAILABLE', 'Não foi possível alterar o vínculo.');
  }
}
