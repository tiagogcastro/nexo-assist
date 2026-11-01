import { createHash, randomBytes } from 'node:crypto';
import { and, count, eq, isNull, sql } from 'drizzle-orm';
import { Resend } from 'resend';
import { db } from '@/db/client';
import { auditLogs, invitations, roles, userRoles } from '@/db/schema/app';
import { session, user } from '@/db/schema/auth';
import { failure, success } from '@/lib/result';
import { requirePermission } from '@/modules/accessControl/permissions';
import { auth } from '@/modules/auth/auth';

export async function listUsers(actorId: string) {
  const permitted = await requirePermission({ userId: actorId, permission: 'users:manage' });
  if (permitted.error) {
    return permitted;
  }

  try {
    const users = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        active: user.active,
        createdAt: user.createdAt,
      })
      .from(user)
      .orderBy(user.name);
    const assignments = await db
      .select({ userId: userRoles.userId, roleId: roles.id, roleName: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id));
    const invites = await db
      .select({
        id: invitations.id,
        email: invitations.email,
        expiresAt: invitations.expiresAt,
        usedAt: invitations.usedAt,
      })
      .from(invitations);
    return success({
      users: users.map((item) => ({
        ...item,
        roles: assignments.filter((assignment) => assignment.userId === item.id),
      })),
      invitations: invites,
    });
  } catch {
    return failure('USERS_UNAVAILABLE', 'Não foi possível consultar os usuários.');
  }
}

export async function createInvitation({
  actorId,
  email,
  requestId,
}: {
  actorId: string;
  email: string;
  requestId: string;
}) {
  const permitted = await requirePermission({ userId: actorId, permission: 'users:manage' });
  if (permitted.error) {
    return permitted;
  }

  const normalized = email.trim().toLowerCase();
  if (!normalized.includes('@')) {
    return failure('VALIDATION_ERROR', 'E-mail inválido.');
  }

  try {
    const exists = await db.query.user.findFirst({ where: eq(user.email, normalized) });
    if (exists) {
      return failure('USER_EXISTS', 'Este usuário já possui uma conta.');
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 86400000);
    const [invitation] = await db
      .insert(invitations)
      .values({ email: normalized, tokenHash, invitedBy: actorId, expiresAt })
      .onConflictDoUpdate({
        target: invitations.email,
        set: { tokenHash, invitedBy: actorId, expiresAt, usedAt: null },
      })
      .returning({ id: invitations.id });
    await db.insert(auditLogs).values({
      actorId,
      action: 'invitation.create',
      resourceType: 'invitation',
      resourceId: invitation.id,
      requestId,
      outcome: 'committed',
    });

    const link = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/accept-invite?email=${encodeURIComponent(normalized)}&token=${token}`;
    let emailed = false;
    if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const sent = await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: normalized,
        subject: 'Convite para o Nexo Assist',
        text: `Crie sua conta pelo link: ${link}`,
      });
      emailed = !sent.error;
    }

    return success({ id: invitation.id, link, emailed, expiresAt });
  } catch {
    return failure('INVITATION_UNAVAILABLE', 'Não foi possível criar o convite.');
  }
}

export async function acceptInvitation({
  email,
  token,
  name,
  password,
}: {
  email: string;
  token: string;
  name: string;
  password: string;
}) {
  const normalized = email.trim().toLowerCase();
  const tokenHash = createHash('sha256').update(token).digest('hex');

  try {
    const invitation = await db.query.invitations.findFirst({
      where: and(
        eq(invitations.email, normalized),
        eq(invitations.tokenHash, tokenHash),
        isNull(invitations.usedAt),
      ),
    });
    if (!invitation || invitation.expiresAt < new Date()) {
      return failure('INVITE_INVALID', 'Convite inválido ou expirado.');
    }

    const response = await auth.handler(
      new Request(
        `${process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'}/api/auth/sign-up/email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-nexo-invitation-token': token },
          body: JSON.stringify({ name, email: normalized, password }),
        },
      ),
    );
    if (!response.ok) {
      return failure('INVITE_INVALID', 'Não foi possível aceitar o convite.');
    }
    return success({ email: normalized });
  } catch {
    return failure('INVITE_INVALID', 'Não foi possível aceitar o convite.');
  }
}

export async function setUserActive({
  actorId,
  targetId,
  active,
  requestId,
}: {
  actorId: string;
  targetId: string;
  active: boolean;
  requestId: string;
}) {
  const permitted = await requirePermission({ userId: actorId, permission: 'users:manage' });
  if (permitted.error) {
    return permitted;
  }

  if (actorId === targetId) {
    return failure('ACCESS_DENIED', 'Você não pode alterar o estado da própria conta.');
  }

  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(1001)`);
      const target = await tx.query.user.findFirst({ where: eq(user.id, targetId) });
      if (!target) {
        return failure('USER_NOT_FOUND', 'Usuário não encontrado.');
      }

      if (!active) {
        const adminRole = await tx.query.roles.findFirst({ where: eq(roles.name, 'admin') });
        if (adminRole) {
          const assignment = await tx.query.userRoles.findFirst({
            where: and(eq(userRoles.userId, targetId), eq(userRoles.roleId, adminRole.id)),
          });
          if (assignment) {
            const [admins] = await tx
              .select({ total: count() })
              .from(userRoles)
              .innerJoin(user, eq(user.id, userRoles.userId))
              .where(and(eq(userRoles.roleId, adminRole.id), eq(user.active, true)));
            if (admins.total <= 1) {
              return failure('LAST_ADMIN', 'Não é possível desativar o último administrador.');
            }
          }
        }
      }

      await tx.update(user).set({ active, updatedAt: new Date() }).where(eq(user.id, targetId));
      if (!active) {
        await tx.delete(session).where(eq(session.userId, targetId));
      }
      await tx.insert(auditLogs).values({
        actorId,
        action: active ? 'user.activate' : 'user.deactivate',
        resourceType: 'user',
        resourceId: targetId,
        requestId,
        outcome: 'committed',
      });
      return success({ id: targetId, active });
    });
  } catch {
    return failure('USERS_UNAVAILABLE', 'Não foi possível alterar o usuário.');
  }
}
