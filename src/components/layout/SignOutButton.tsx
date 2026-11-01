'use client';

import { useRouter } from 'next/navigation';
import { authClient } from '@/modules/auth/auth-client';

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <button className="sign-out" type="button" onClick={signOut}>
      Sair
    </button>
  );
}
