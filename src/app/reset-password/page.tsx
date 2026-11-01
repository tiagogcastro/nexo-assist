import { Suspense } from 'react';
import { ResetPasswordForm } from '@/modules/auth/PasswordForms';

export default function ResetPasswordPage() {
  return (
    <main className="password-layout">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
