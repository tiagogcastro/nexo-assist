import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createHash } from 'node:crypto';
import { eq, gt, and, isNull } from 'drizzle-orm';
import { Resend } from 'resend';
import { db } from '@/db/client';
import { invitations, roles, userRoles } from '@/db/schema/app';
import * as authSchema from '@/db/schema/auth';

const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }
    : undefined;
const github =
  process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET }
    : undefined;

async function sendAuthEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({ from: process.env.EMAIL_FROM, to, subject, text });
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: Boolean(process.env.RESEND_API_KEY),
    ...(process.env.RESEND_API_KEY && process.env.EMAIL_FROM
      ? {
          sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
            await sendAuthEmail({
              to: user.email,
              subject: 'Redefinir senha do Nexo Assist',
              text: `Use este link para redefinir sua senha: ${url}`,
            });
          },
        }
      : {}),
  },
  emailVerification: {
    sendOnSignUp: Boolean(process.env.RESEND_API_KEY),
    sendVerificationEmail: async ({ user, url }) => {
      await sendAuthEmail({
        to: user.email,
        subject: 'Verifique seu e-mail no Nexo Assist',
        text: `Use este link para verificar seu e-mail: ${url}`,
      });
    },
  },
  socialProviders: { ...(google ? { google } : {}), ...(github ? { github } : {}) },
  account: { accountLinking: { enabled: true, disableImplicitLinking: true } },
  user: {
    validateUserInfo: async ({ user, source }, context) => {
      if (source.action === 'link-account') {
        return;
      }

      const email = user.email?.toLowerCase();
      if (!email) {
        return { error: 'INVITE_REQUIRED' };
      }

      if (source.action === 'sign-in') {
        const existingUser = await db.query.user.findFirst({
          where: eq(authSchema.user.email, email),
          columns: { active: true },
        });
        return existingUser?.active ? undefined : { error: 'ACCESS_DENIED' };
      }

      if (source.action === 'create-user' && source.method !== 'email-password') {
        return { error: 'INVITE_REQUIRED' };
      }

      const token = context.request?.headers.get('x-nexo-invitation-token');
      if (source.action === 'create-user' && !token) {
        return { error: 'INVITE_REQUIRED' };
      }

      const invitation = await db.query.invitations.findFirst({
        where: and(
          eq(invitations.email, email),
          gt(invitations.expiresAt, new Date()),
          source.action === 'create-user' ? isNull(invitations.usedAt) : undefined,
        ),
      });

      if (
        !invitation ||
        (source.action === 'create-user' &&
          invitation.tokenHash !==
            createHash('sha256')
              .update(token ?? '')
              .digest('hex'))
      ) {
        return { error: 'INVITE_REQUIRED' };
      }
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          const employeeRole = await db.query.roles.findFirst({
            where: eq(roles.name, 'employee'),
          });

          if (employeeRole) {
            await db.insert(userRoles).values({ userId: createdUser.id, roleId: employeeRole.id });
          }

          await db
            .update(invitations)
            .set({ usedAt: new Date() })
            .where(eq(invitations.email, createdUser.email.toLowerCase()));
        },
      },
    },
    session: {
      create: {
        before: async (newSession) => {
          const existing = await db.query.user.findFirst({
            where: eq(authSchema.user.id, newSession.userId),
            columns: { active: true },
          });
          return existing?.active ? true : false;
        },
      },
    },
  },
});
