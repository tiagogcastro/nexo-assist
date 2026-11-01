import { Suspense } from 'react';
import { AcceptInviteForm } from '@/modules/auth/AcceptInviteForm';

export default function AcceptInvitePage() {
  return (
    <main className="password-layout">
      <Suspense>
        <AcceptInviteForm />
      </Suspense>
    </main>
  );
}
