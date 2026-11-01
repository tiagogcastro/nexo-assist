'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

export function AcceptInviteForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [token, setToken] = useState(params.get('token') ?? '');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const response = await fetch('/api/v1/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, name, password }),
      });
      const body = await response.json();
      setNotice(
        response.ok
          ? 'Conta criada. Entre com sua nova senha.'
          : (body.error?.message ?? 'Não foi possível aceitar o convite.'),
      );
    } catch {
      setNotice('Falha de conexão.');
    }
  }

  return (
    <form className="password-form" onSubmit={submit}>
      <h1>Aceitar convite</h1>
      <p>Crie sua conta para usar o service desk.</p>
      <label>
        Nome
        <input value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label>
        E-mail corporativo
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <label>
        Código do convite
        <input value={token} onChange={(event) => setToken(event.target.value)} required />
      </label>
      <label>
        Senha
        <input
          type="password"
          minLength={12}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      <button className="primary-button">Criar conta</button>
      {notice && <p role="status">{notice}</p>}
      <Link href="/login">Ir para entrada</Link>
    </form>
  );
}
