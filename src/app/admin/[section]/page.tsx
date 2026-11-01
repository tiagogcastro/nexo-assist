import { notFound, redirect } from 'next/navigation';
import { getActor } from '@/modules/auth/actor';
import { requirePermission, type PermissionKey } from '@/modules/accessControl/permissions';
import { AdminClient } from '@/modules/users/AdminClient';

const SECTIONS: Record<string, PermissionKey> = {
  users: 'users:manage',
  roles: 'roles:manage',
  'ai-providers': 'providers:manage',
  observability: 'observability:read',
  decisions: 'audit:read-all',
  audit: 'audit:read-all',
};

export default async function AdminSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const permission = SECTIONS[section];
  if (!permission) {
    notFound();
  }

  const actor = await getActor();
  if (actor.error) {
    redirect('/login');
  }

  const permitted = await requirePermission({ userId: actor.data.id, permission });
  if (permitted.error) {
    redirect('/chat');
  }

  return <AdminClient section={section} actorName={actor.data.name} />;
}
