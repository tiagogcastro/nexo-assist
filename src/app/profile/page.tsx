import { redirect } from 'next/navigation';
import { EmployeeShell } from '@/components/layout/EmployeeShell';
import { getActor } from '@/modules/auth/actor';
import { ProfileClient } from '@/modules/auth/ProfileClient';

export default async function ProfilePage() {
  const actor = await getActor();
  if (actor.error) {
    redirect('/login');
  }

  return (
    <EmployeeShell active="profile" actor={actor.data}>
      <ProfileClient
        name={actor.data.name}
        email={actor.data.email}
        emailEnabled={Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)}
        googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
        githubEnabled={Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)}
      />
    </EmployeeShell>
  );
}
