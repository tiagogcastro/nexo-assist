import Link from 'next/link';
import { SignOutButton } from '@/components/layout/SignOutButton';

export function EmployeeShell({
  children,
  active,
  actor,
  assistantAvailable,
}: {
  children: React.ReactNode;
  active: 'chat' | 'profile';
  actor: { name: string; email: string };
  assistantAvailable?: boolean;
}) {
  const initials = actor.name
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="employee-layout">
      <aside className="employee-sidebar">
        <Link className="brand" href="/chat">
          <span className="brand-mark">N</span>Nexo Assist
        </Link>
        <nav aria-label="Navegação principal" className="employee-nav">
          <Link className={active === 'chat' ? 'active' : ''} href="/chat">
            Atendimento
          </Link>
          <Link className={active === 'profile' ? 'active' : ''} href="/profile">
            Meu perfil
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-person">
            <span className="avatar">{initials}</span>
            <div>
              <strong>{actor.name}</strong>
              <small>{actor.email}</small>
            </div>
          </div>
          <SignOutButton />
        </div>
      </aside>
      <main className="employee-main">
        <header className="employee-topbar">
          <span>Service desk de TI</span>
          <span className="crumb-divider">/</span>
          <strong>{active === 'chat' ? 'Atendimento' : 'Meu perfil'}</strong>
          {active === 'chat' && (
            <span className={assistantAvailable ? 'online-pill' : 'offline-pill'}>
              {assistantAvailable ? '● Assistente online' : 'Assistente não configurado'}
            </span>
          )}
        </header>
        {children}
      </main>
    </div>
  );
}
