import { redirect } from 'next/navigation';
import { getActor } from '@/modules/auth/actor';
import { requirePermission } from '@/modules/accessControl/permissions';
import { ConsoleClient } from '@/modules/handoffs/ConsoleClient';

export default async function ConsolePage() {
  const actor = await getActor();
  if (actor.error) {
    redirect('/login');
  }

  const permitted = await requirePermission({
    userId: actor.data.id,
    permission: 'conversations:read-queue',
  });
  if (permitted.error) {
    redirect('/chat');
  }

  return <ConsoleClient />;
}
