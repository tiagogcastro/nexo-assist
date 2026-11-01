import { redirect } from 'next/navigation';
import { EmployeeShell } from '@/components/layout/EmployeeShell';
import { ChatClient } from '@/modules/conversations/ChatClient';
import { getActor } from '@/modules/auth/actor';
import { requirePermission } from '@/modules/accessControl/permissions';
import { getActiveProvider } from '@/modules/aiProviders/provider-service';

export default async function ChatPage() {
  const actor = await getActor();
  if (actor.error) {
    redirect('/login');
  }

  const access = await requirePermission({
    userId: actor.data.id,
    permission: 'conversations:read-own',
  });
  if (access.error) {
    redirect('/console');
  }

  const provider = await getActiveProvider();
  return (
    <EmployeeShell active="chat" actor={actor.data} assistantAvailable={!provider.error}>
      <ChatClient />
    </EmployeeShell>
  );
}
