import { and, eq } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import { db } from '@/db/client';
import {
  helpArticles,
  invitations,
  permissions,
  rolePermissions,
  roles,
  tickets,
  ticketSequence,
  userRoles,
} from '@/db/schema/app';
import { user } from '@/db/schema/auth';
import { PERMISSION_KEYS } from '@/modules/accessControl/permissions';
import { acceptInvitation } from '@/modules/users/user-service';
import { getSlaDeadline } from '@/modules/tickets/sla';

const ROLE_PERMISSIONS = {
  employee: [
    'tickets:read-own',
    'tickets:create-draft',
    'tickets:confirm-own',
    'conversations:read-own',
    'conversations:handoff-own',
  ],
  analyst: [
    'tickets:read-assigned',
    'tickets:update-assigned',
    'conversations:read-queue',
    'conversations:claim',
    'conversations:respond-assigned',
    'observability:read',
  ],
  admin: [...PERMISSION_KEYS],
};

const ARTICLES = [
  {
    slug: 'vpn-erro-809-windows-10',
    title: 'VPN com erro 809 no Windows 10',
    body: 'No Windows 10, reinstale o cliente de VPN pelo portal de softwares e reinicie o computador. No Windows 11, abra um chamado; este procedimento não se aplica.',
  },
  {
    slug: 'horario-service-desk',
    title: 'Horário do service desk',
    body: 'Atendimento de segunda a sexta, das 08h às 18h, no horário de São Paulo. Chamados críticos têm plantão 24 horas.',
  },
  {
    slug: 'senha-redefinicao',
    title: 'Redefinição de senha corporativa',
    body: 'Use a opção Esqueci minha senha na tela de entrada. Se você não tiver acesso ao e-mail corporativo, peça atendimento humano.',
  },
  {
    slug: 'software-portal',
    title: 'Instalar software aprovado',
    body: 'Procure o aplicativo no portal de softwares. Caso não apareça, abra uma requisição informando nome, versão e motivo de uso.',
  },
  {
    slug: 'equipamento-segundo-monitor',
    title: 'Solicitar segundo monitor',
    body: 'Abra uma requisição de Hardware com a justificativa e o endereço de entrega. A solicitação passa por aprovação.',
  },
  {
    slug: 'email-sem-sincronizar',
    title: 'E-mail sem sincronizar',
    body: 'Confirme a conexão de rede e reinicie o aplicativo de e-mail. Se o problema continuar, abra um incidente com a mensagem de erro.',
  },
  {
    slug: 'acesso-sap',
    title: 'Acesso ao SAP',
    body: 'Para desbloqueio de senha, abra um incidente de Acesso. Para novo perfil de acesso, abra uma requisição e informe o perfil necessário.',
  },
  {
    slug: 'notebook-lento',
    title: 'Notebook lento',
    body: 'Reinicie o notebook e verifique se há atualização pendente. Se a lentidão persistir, abra um incidente informando o modelo e quando começou.',
  },
];

async function seedRoles() {
  for (const key of PERMISSION_KEYS) {
    await db.insert(permissions).values({ key, description: key }).onConflictDoNothing();
  }

  for (const [name, keys] of Object.entries(ROLE_PERMISSIONS)) {
    const [role] = await db
      .insert(roles)
      .values({
        name,
        description: name === 'admin' ? 'Full application administration' : name,
        protected: true,
      })
      .onConflictDoUpdate({ target: roles.name, set: { active: true } })
      .returning();

    for (const permissionKey of keys) {
      await db
        .insert(rolePermissions)
        .values({ roleId: role.id, permissionKey })
        .onConflictDoNothing();
    }
  }
}

async function seedUser({
  email,
  password,
  name,
  roleName,
}: {
  email: string;
  password: string;
  name: string;
  roleName: string;
}) {
  const normalizedEmail = email.toLowerCase();
  const token = randomBytes(32).toString('hex');
  await db
    .insert(invitations)
    .values({
      email: normalizedEmail,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    })
    .onConflictDoUpdate({
      target: invitations.email,
      set: {
        tokenHash: createHash('sha256').update(token).digest('hex'),
        usedAt: null,
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      },
    });

  let existing = await db.query.user.findFirst({ where: eq(user.email, normalizedEmail) });
  if (!existing) {
    const accepted = await acceptInvitation({ name, email: normalizedEmail, password, token });
    if (accepted.error) {
      console.error('Could not seed account', {
        email: normalizedEmail,
        code: accepted.error.code,
      });
      process.exitCode = 1;
    }
    existing = await db.query.user.findFirst({ where: eq(user.email, normalizedEmail) });
  }

  if (!existing) {
    return;
  }

  const role = await db.query.roles.findFirst({ where: eq(roles.name, roleName) });
  if (role) {
    await db
      .insert(userRoles)
      .values({ userId: existing.id, roleId: role.id })
      .onConflictDoNothing();
  }
}

async function seedTickets() {
  const employee = await db.query.user.findFirst({
    where: eq(user.email, 'ana.souza@nexo.com.br'),
  });
  const other = await db.query.user.findFirst({
    where: eq(user.email, 'bruno.tavares@nexo.com.br'),
  });

  if (!employee || !other) {
    return;
  }

  const samples = [
    {
      creatorId: employee.id,
      type: 'INC',
      title: 'Notebook lento após atualização do Windows',
      category: 'Hardware',
      priority: 'medium',
      status: 'awaiting_analyst',
      dueAt: new Date(Date.now() - 4 * 86400000),
    },
    {
      creatorId: employee.id,
      type: 'REQ',
      title: 'Segundo monitor para home office',
      category: 'Hardware',
      priority: 'low',
      status: 'approved',
      dueAt: new Date(Date.now() + 4 * 86400000),
    },
    {
      creatorId: employee.id,
      type: 'INC',
      title: 'Senha do SAP bloqueada',
      category: 'Acesso',
      priority: 'medium',
      status: 'resolved',
      dueAt: new Date(Date.now() - 5 * 86400000),
      resolvedAt: new Date(Date.now() - 4 * 86400000),
    },
    {
      creatorId: other.id,
      type: 'INC',
      title: 'VPN sem conexão em outra conta',
      category: 'Rede e VPN',
      priority: 'high',
      status: 'open',
      dueAt: getSlaDeadline({ from: new Date(), priority: 'high' }),
    },
  ];

  for (const sample of samples) {
    const exists = await db.query.tickets.findFirst({
      where: and(eq(tickets.creatorId, sample.creatorId), eq(tickets.title, sample.title)),
    });

    if (exists) {
      continue;
    }

    const [sequence] = await db.insert(ticketSequence).values({}).returning();
    await db.insert(tickets).values({
      ...sample,
      code: `${sample.type}-${String(sequence.id).padStart(5, '0')}`,
      affectedUserId: sample.creatorId,
      description: `Dados de demonstração para ${sample.title}.`,
      normalizedProblem: sample.title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim(),
    });
  }
}

async function main() {
  await seedRoles();

  for (const article of ARTICLES) {
    await db
      .insert(helpArticles)
      .values(article)
      .onConflictDoUpdate({
        target: helpArticles.slug,
        set: { title: article.title, body: article.body, updatedAt: new Date() },
      });
  }

  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    await seedUser({
      email: adminEmail,
      password: adminPassword,
      name: 'Nexo Admin',
      roleName: 'admin',
    });
  }

  const employeePassword = process.env.DEMO_EMPLOYEE_PASSWORD;
  if (employeePassword) {
    await seedUser({
      email: 'ana.souza@nexo.com.br',
      password: employeePassword,
      name: 'Ana Souza',
      roleName: 'employee',
    });
    await seedUser({
      email: 'bruno.tavares@nexo.com.br',
      password: employeePassword,
      name: 'Bruno Tavares',
      roleName: 'employee',
    });
  }

  const analystPassword = process.env.DEMO_ANALYST_PASSWORD;
  if (analystPassword) {
    await seedUser({
      email: 'rafael.lima@nexo.com.br',
      password: analystPassword,
      name: 'Rafael Lima',
      roleName: 'analyst',
    });
  }

  await seedTickets();
  console.info('Seed complete.');
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
