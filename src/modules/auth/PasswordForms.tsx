'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/modules/auth/auth-client';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await authClient.requestPasswordReset({ email, redirectTo: '/reset-password' });
    setNotice(
      result.error
        ? 'Não foi possível processar a solicitação.'
        : 'Se a conta estiver ativa, você receberá um link.',
    );
  }

  return (
    <form className="password-form" onSubmit={submit}>
      <h1>Redefinir senha</h1>
      <p>Informe seu e-mail corporativo para receber um link de redefinição.</p>
      <label>
        E-mail corporativo
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <button className="primary-button">Enviar link</button>
      {notice && <p role="status">{notice}</p>}
      <Link href="/login">Voltar à entrada</Link>
    </form>
  );
}

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setNotice('Link inválido ou expirado.');
      return;
    }

    const result = await authClient.resetPassword({ token, newPassword: password });
    setNotice(
      result.error
        ? 'Não foi possível redefinir a senha.'
        : 'Senha atualizada. Entre com a nova senha.',
    );
  }

  return (
    <form className="password-form" onSubmit={submit}>
      <h1>Nova senha</h1>
      <p>Escolha uma senha segura para sua conta.</p>
      <label>
        Nova senha
        <input
          type="password"
          minLength={12}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      <button className="primary-button">Salvar senha</button>
      {notice && <p role="status">{notice}</p>}
      <Link href="/login">Voltar à entrada</Link>
    </form>
  );
}
