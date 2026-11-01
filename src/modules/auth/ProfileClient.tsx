'use client';

import { useEffect, useState } from 'react';
import { authClient } from '@/modules/auth/auth-client';

type Account = { id: string; providerId: string };

export function ProfileClient({
  name,
  email,
  emailEnabled,
  googleEnabled,
  githubEnabled,
}: {
  name: string;
  email: string;
  emailEnabled: boolean;
  googleEnabled: boolean;
  githubEnabled: boolean;
}) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    authClient.listAccounts().then(({ data }) => setAccounts(data ?? []));
  }, []);

  async function resetPassword() {
    if (!emailEnabled) {
      return;
    }

    const result = await authClient.requestPasswordReset({ email, redirectTo: '/reset-password' });
    setNotice(
      result.error
        ? 'Não foi possível enviar o link.'
        : 'Se a conta estiver ativa, um link será enviado por e-mail.',
    );
  }

  async function unlink(accountId: string) {
    const result = await authClient.unlinkAccount({ accountId });
    if (result.error) {
      setNotice('Não foi possível desvincular esta conta.');
      return;
    }

    const refreshed = await authClient.listAccounts();
    setAccounts(refreshed.data ?? []);
    setNotice('Conta desvinculada.');
  }

  return (
    <div className="profile-page">
      <div className="profile-head">
        <h1>Meu perfil</h1>
        <p>Seus dados de acesso ao service desk de TI.</p>
      </div>
      <div className="profile-card">
        <div className="profile-row">
          <div>
            <strong>Nome</strong>
            <span>{name}</span>
          </div>
        </div>
        <div className="profile-row">
          <div>
            <strong>E-mail corporativo</strong>
            <span>{email}</span>
          </div>
          <small>Gerenciado pela TI</small>
        </div>
        <div className="profile-row">
          <div>
            <strong>Senha</strong>
            <span>Protegida pela sua conta</span>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={resetPassword}
            disabled={!emailEnabled}
          >
            Redefinir senha
          </button>
        </div>
      </div>
      <p className="profile-hint">
        {emailEnabled
          ? `Enviaremos um link de redefinição para ${email}.`
          : 'Redefinição por e-mail indisponível. Contate a TI.'}
      </p>
      {notice && (
        <p className="chat-notice" role="status">
          {notice}
        </p>
      )}
      {(googleEnabled || githubEnabled) && (
        <div className="profile-card">
          <h2>Contas conectadas</h2>
          {(['google', 'github'] as const)
            .filter((provider) => (provider === 'google' ? googleEnabled : githubEnabled))
            .map((provider) => {
              const account = accounts.find((item) => item.providerId === provider);
              return (
                <div className="profile-row" key={provider}>
                  <div>
                    <strong>{provider === 'google' ? 'Google' : 'GitHub'}</strong>
                    <span>{account ? 'Conectada' : 'Não conectada'}</span>
                  </div>
                  {account ? (
                    <button className="secondary-button" onClick={() => unlink(account.id)}>
                      Desvincular
                    </button>
                  ) : (
                    <button
                      className="secondary-button"
                      onClick={() => authClient.linkSocial({ provider, callbackURL: '/profile' })}
                    >
                      Vincular
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
