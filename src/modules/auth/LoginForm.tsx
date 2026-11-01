'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/modules/auth/auth-client';

export function LoginForm({
  googleEnabled,
  githubEnabled,
}: {
  googleEnabled: boolean;
  githubEnabled: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const result = await authClient.signIn.email({ email, password });
    setLoading(false);

    if (result.error) {
      setError('E-mail ou senha inválidos.');
      return;
    }

    router.replace('/chat');
    router.refresh();
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <div className="login-icon">N</div>
      <p className="eyebrow">BEM-VINDO DE VOLTA</p>
      <h1>Entre na sua conta.</h1>
      <p className="form-intro">
        Acesse o service desk da Nexo para resolver suas dúvidas e acompanhar seus chamados.
      </p>
      <label htmlFor="email">E-mail corporativo</label>
      <input
        id="email"
        type="email"
        autoComplete="username"
        placeholder="seu.nome@nexo.com.br"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <label htmlFor="password">Senha</label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        placeholder="Sua senha"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <div className="form-link">
        <Link href="/forgot-password">Esqueceu sua senha?</Link>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="primary-button" type="submit" disabled={loading}>
        {loading ? 'Entrando...' : 'Entrar na plataforma →'}
      </button>
      {(googleEnabled || githubEnabled) && <div className="login-divider">ou continue com</div>}
      <div className="social-buttons">
        {googleEnabled && (
          <button type="button" onClick={() => authClient.signIn.social({ provider: 'google' })}>
            Google
          </button>
        )}
        {githubEnabled && (
          <button type="button" onClick={() => authClient.signIn.social({ provider: 'github' })}>
            GitHub
          </button>
        )}
      </div>
      <p className="login-note">Acesso restrito a contas autorizadas pela Nexo.</p>
    </form>
  );
}
