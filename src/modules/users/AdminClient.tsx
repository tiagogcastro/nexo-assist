'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { SignOutButton } from '@/components/layout/SignOutButton';

type Role = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  protected: boolean;
  permissions: string[];
};
type CatalogItem = { key: string; description: string };
type User = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  roles: { roleId: string; roleName: string }[];
};
type Invitation = { id: string; email: string; expiresAt: string; usedAt: string | null };
type Provider = { id: string; kind: string; name: string; active: boolean; key: string };
type Model = { id: string; providerId: string; modelId: string; active: boolean };
type Usage = {
  day: string;
  provider: string;
  model: string;
  status: string;
  requests: number;
  inputTokens: number | null;
  outputTokens: number | null;
  averageLatencyMs: number | null;
  estimatedCostUsdMicros: number | null;
};
type Audit = {
  id: string;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: string;
  createdAt: string;
};
type Decision = {
  id: string;
  intent: string;
  action: string;
  rationale: string;
  confidence: string;
  evidence: { tools?: string[] };
  createdAt: string;
};

async function api<T>(
  url: string,
  method = 'GET',
  body?: unknown,
): Promise<{ data: T | null; error: string | null }> {
  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
    const payload = await response.json();
    return response.ok
      ? { data: payload.data, error: null }
      : { data: null, error: payload.error?.message ?? 'Falha na operação.' };
  } catch {
    return { data: null, error: 'Falha de conexão.' };
  }
}

const NAV = [
  ['users', 'Usuários'],
  ['roles', 'Perfis'],
  ['ai-providers', 'Provedores de IA'],
  ['observability', 'Observabilidade'],
  ['decisions', 'Decisões'],
  ['audit', 'Auditoria'],
];

export function AdminClient({ section, actorName }: { section: string; actorName: string }) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [providerKind, setProviderKind] = useState('deepseek');
  const [providerName, setProviderName] = useState('DeepSeek');
  const [modelId, setModelId] = useState('deepseek-flash');
  const [apiKey, setApiKey] = useState('');
  const usersQuery = useQuery({
    queryKey: ['adminUsers'],
    queryFn: () => api<{ users: User[]; invitations: Invitation[] }>('/api/v1/users'),
    enabled: section === 'users',
  });
  const rolesQuery = useQuery({
    queryKey: ['adminRoles'],
    queryFn: () => api<{ roles: Role[]; catalog: CatalogItem[] }>('/api/v1/roles'),
    enabled: section === 'roles' || section === 'users',
  });
  const providersQuery = useQuery({
    queryKey: ['adminProviders'],
    queryFn: () => api<{ providers: Provider[]; models: Model[] }>('/api/v1/ai-providers'),
    enabled: section === 'ai-providers',
  });
  const usageQuery = useQuery({
    queryKey: ['adminUsage'],
    queryFn: () => api<Usage[]>('/api/v1/observability/usage'),
    enabled: section === 'observability',
  });
  const decisionsQuery = useQuery({
    queryKey: ['adminDecisions'],
    queryFn: () => api<Decision[]>('/api/v1/agent-decisions'),
    enabled: section === 'decisions',
  });
  const auditQuery = useQuery({
    queryKey: ['adminAudit'],
    queryFn: () => api<Audit[]>('/api/v1/audit-logs'),
    enabled: section === 'audit',
  });

  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await api<{ link: string; emailed: boolean }>('/api/v1/invitations', 'POST', {
      email: inviteEmail,
    });
    setNotice(
      result.error ??
        (result.data?.emailed
          ? 'Convite enviado por e-mail.'
          : 'Convite criado. Copie o link para entregar ao usuário.'),
    );
    setInviteLink(result.data?.link ?? '');
    await queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
  }

  async function changeUser(id: string, active: boolean) {
    const result = await api(`/api/v1/users/${id}`, 'PATCH', { active });
    setNotice(result.error ?? 'Conta atualizada.');
    await queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
  }

  async function assignRole(userId: string, roleId: string, assign: boolean) {
    const result = await api('/api/v1/user-roles', 'POST', { userId, roleId, assign });
    setNotice(result.error ?? 'Perfil atualizado.');
    await queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
  }

  function editRole(role: Role | null) {
    setEditingRole(role);
    setRoleName(role?.name ?? '');
    setRoleDescription(role?.description ?? '');
    setSelectedPermissions(role?.permissions ?? []);
  }

  async function saveRole(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = editingRole
      ? await api(`/api/v1/roles/${editingRole.id}`, 'PATCH', {
          name: roleName,
          description: roleDescription,
          active: editingRole.active,
          permissionKeys: selectedPermissions,
        })
      : await api('/api/v1/roles', 'POST', {
          name: roleName,
          description: roleDescription,
          permissionKeys: selectedPermissions,
        });
    setNotice(result.error ?? 'Perfil salvo.');
    if (!result.error) {
      editRole(null);
      await queryClient.invalidateQueries({ queryKey: ['adminRoles'] });
    }
  }

  async function toggleRole(role: Role) {
    const result = await api(`/api/v1/roles/${role.id}`, 'PATCH', {
      name: role.name,
      description: role.description,
      active: !role.active,
      permissionKeys: role.permissions,
    });
    setNotice(result.error ?? 'Perfil atualizado.');
    await queryClient.invalidateQueries({ queryKey: ['adminRoles'] });
  }

  async function testProvider() {
    const result = await api<{ modelId: string }>('/api/v1/ai-providers/test', 'POST', {
      kind: providerKind,
      modelId,
      apiKey,
    });
    setNotice(result.error ?? `Conexão verificada para ${result.data?.modelId}.`);
  }

  async function saveProvider(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await api('/api/v1/ai-providers', 'POST', {
      kind: providerKind,
      name: providerName,
      modelId,
      apiKey,
    });
    setNotice(result.error ?? 'Modelo ativo atualizado. A chave foi protegida no servidor.');
    if (!result.error) {
      setApiKey('');
      await queryClient.invalidateQueries({ queryKey: ['adminProviders'] });
    }
  }

  async function removeProvider(provider: Provider) {
    if (!window.confirm(`Remover a credencial de ${provider.name}?`)) {
      return;
    }

    const result = await api(`/api/v1/ai-providers/${provider.id}`, 'DELETE');
    setNotice(result.error ?? 'Credencial removida.');
    if (!result.error) {
      await queryClient.invalidateQueries({ queryKey: ['adminProviders'] });
    }
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <Link className="brand" href="/admin">
          <span className="brand-mark">N</span>Nexo Assist
        </Link>
        <p>ADMINISTRAÇÃO</p>
        <nav>
          {NAV.map(([key, label]) => (
            <Link key={key} href={`/admin/${key}`} className={section === key ? 'active' : ''}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <Link href="/console">Console de atendimento</Link>
          <Link href="/chat">Chat</Link>
          <SignOutButton />
        </div>
      </aside>
      <main className="admin-main">
        <header>
          <span>Administração / {NAV.find(([key]) => key === section)?.[1]}</span>
          <strong>{actorName}</strong>
        </header>
        <div className="admin-content">
          <h1>{NAV.find(([key]) => key === section)?.[1]}</h1>
          {notice && (
            <p className="chat-notice" role="status">
              {notice}
            </p>
          )}
          {section === 'users' && (
            <>
              <div className="admin-card">
                <h2>Convidar usuário</h2>
                <form className="admin-inline-form" onSubmit={invite}>
                  <input
                    type="email"
                    placeholder="nome@nexo.com.br"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    required
                  />
                  <button className="primary-button">Criar convite</button>
                </form>
                {inviteLink && (
                  <div className="invite-link">
                    <span>Link do convite (mostrado uma vez)</span>
                    <input readOnly value={inviteLink} onFocus={(event) => event.target.select()} />
                  </div>
                )}
              </div>
              <div className="admin-card">
                <h2>Usuários</h2>
                {usersQuery.data?.error && <p className="form-error">{usersQuery.data.error}</p>}
                <div className="admin-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>E-mail</th>
                        <th>Perfis</th>
                        <th>Estado</th>
                        <th>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersQuery.data?.data?.users.map((item) => (
                        <tr key={item.id}>
                          <td>{item.name}</td>
                          <td>{item.email}</td>
                          <td>
                            {rolesQuery.data?.data?.roles.map((role) => (
                              <label className="role-check" key={role.id}>
                                <input
                                  type="checkbox"
                                  checked={item.roles.some(
                                    (assigned) => assigned.roleId === role.id,
                                  )}
                                  onChange={(event) =>
                                    assignRole(item.id, role.id, event.target.checked)
                                  }
                                />
                                {role.name}
                              </label>
                            ))}
                          </td>
                          <td>{item.active ? 'Ativo' : 'Inativo'}</td>
                          <td>
                            <button
                              className="secondary-button"
                              onClick={() => changeUser(item.id, !item.active)}
                            >
                              {item.active ? 'Desativar' : 'Ativar'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="admin-card">
                <h2>Convites</h2>
                {usersQuery.data?.data?.invitations.map((item) => (
                  <p key={item.id} className="admin-row">
                    {item.email}
                    <span>
                      {item.usedAt
                        ? 'Aceito'
                        : new Date(item.expiresAt) < new Date()
                          ? 'Expirado'
                          : 'Pendente'}
                    </span>
                  </p>
                ))}
              </div>
            </>
          )}
          {section === 'roles' && (
            <div className="admin-grid">
              <div className="admin-card">
                <h2>Perfis de acesso</h2>
                {rolesQuery.data?.data?.roles.map((role) => (
                  <div className="admin-row" key={role.id}>
                    <div>
                      <strong>{role.name}</strong>
                      <small>
                        {role.permissions.length} permissões · {role.active ? 'Ativo' : 'Inativo'}
                      </small>
                    </div>
                    <div>
                      {!role.protected && (
                        <>
                          <button onClick={() => editRole(role)}>Editar</button>
                          <button onClick={() => toggleRole(role)}>
                            {role.active ? 'Desativar' : 'Ativar'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                <button className="secondary-button" onClick={() => editRole(null)}>
                  Novo perfil
                </button>
              </div>
              <form className="admin-card admin-form" onSubmit={saveRole}>
                <h2>{editingRole ? `Editar ${editingRole.name}` : 'Novo perfil'}</h2>
                <label>
                  Nome
                  <input
                    value={roleName}
                    onChange={(event) => setRoleName(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Descrição
                  <input
                    value={roleDescription}
                    onChange={(event) => setRoleDescription(event.target.value)}
                  />
                </label>
                <h3>Permissões</h3>
                <div className="permission-list">
                  {rolesQuery.data?.data?.catalog.map((permission) => (
                    <label key={permission.key}>
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(permission.key)}
                        onChange={(event) =>
                          setSelectedPermissions((current) =>
                            event.target.checked
                              ? [...current, permission.key]
                              : current.filter((key) => key !== permission.key),
                          )
                        }
                      />
                      {permission.key}
                    </label>
                  ))}
                </div>
                <button className="primary-button">Salvar perfil</button>
              </form>
            </div>
          )}
          {section === 'ai-providers' && (
            <div className="admin-grid">
              <div className="admin-card">
                <h2>Provedores cadastrados</h2>
                {providersQuery.data?.data?.providers.map((provider) => (
                  <p className="admin-row" key={provider.id}>
                    <span>
                      <strong>{provider.name}</strong>
                      <small>
                        {provider.kind} · {provider.key}
                      </small>
                    </span>
                    <span>
                      <em>{provider.active ? 'Ativo' : 'Inativo'}</em>
                      <button type="button" onClick={() => removeProvider(provider)}>
                        Remover
                      </button>
                    </span>
                  </p>
                ))}
                <p className="admin-muted">
                  Sem configuração, a variável DEEPSEEK_API_KEY pode habilitar o modelo local.
                </p>
              </div>
              <form className="admin-card admin-form" onSubmit={saveProvider}>
                <h2>Configurar modelo ativo</h2>
                <label>
                  Provedor
                  <select
                    value={providerKind}
                    onChange={(event) => setProviderKind(event.target.value)}
                  >
                    <option value="deepseek">DeepSeek</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="openrouter">OpenRouter</option>
                  </select>
                </label>
                <label>
                  Nome
                  <input
                    value={providerName}
                    onChange={(event) => setProviderName(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Modelo
                  <input
                    value={modelId}
                    onChange={(event) => setModelId(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Chave de API
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    autoComplete="off"
                    required
                  />
                </label>
                <div className="admin-form-actions">
                  <button type="button" className="secondary-button" onClick={testProvider}>
                    Testar conexão
                  </button>
                  <button className="primary-button">Salvar e ativar</button>
                </div>
                <small>
                  A ativação exige validação real da credencial e do modelo. Custos dependem do
                  provedor.
                </small>
              </form>
            </div>
          )}
          {section === 'observability' && (
            <div className="admin-card">
              <h2>Uso de IA</h2>
              <p className="admin-muted">
                Tokens e latência são observados quando o provedor fornece os dados. Custos são
                estimativas quando configurados; valores ausentes aparecem como desconhecidos.
              </p>
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Dia</th>
                      <th>Provedor</th>
                      <th>Modelo</th>
                      <th>Estado</th>
                      <th>Chamadas</th>
                      <th>Tokens entrada</th>
                      <th>Tokens saída</th>
                      <th>Latência média</th>
                      <th>Custo estimado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageQuery.data?.data?.map((row, index) => (
                      <tr key={`${row.day}-${row.model}-${index}`}>
                        <td>{row.day}</td>
                        <td>{row.provider}</td>
                        <td>{row.model}</td>
                        <td>{row.status}</td>
                        <td>{row.requests}</td>
                        <td>{row.inputTokens ?? '—'}</td>
                        <td>{row.outputTokens ?? '—'}</td>
                        <td>
                          {row.averageLatencyMs ? `${Math.round(row.averageLatencyMs)} ms` : '—'}
                        </td>
                        <td>
                          {row.estimatedCostUsdMicros === null
                            ? '—'
                            : `$${(row.estimatedCostUsdMicros / 1_000_000).toFixed(4)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {section === 'decisions' && (
            <div className="admin-card">
              <h2>Decisões do assistente</h2>
              {decisionsQuery.data?.data?.map((item) => (
                <details className="decision-row" key={item.id}>
                  <summary>
                    {new Date(item.createdAt).toLocaleString('pt-BR')} · {item.action} ·{' '}
                    {item.confidence}
                  </summary>
                  <p>Intenção: {item.intent}</p>
                  <p>Justificativa: {item.rationale}</p>
                  <p>Ferramentas: {item.evidence.tools?.join(', ') || 'nenhuma'}</p>
                </details>
              ))}
            </div>
          )}
          {section === 'audit' && (
            <div className="admin-card">
              <h2>Registro de auditoria</h2>
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Ação</th>
                      <th>Recurso</th>
                      <th>Ator</th>
                      <th>Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditQuery.data?.data?.map((item) => (
                      <tr key={item.id}>
                        <td>{new Date(item.createdAt).toLocaleString('pt-BR')}</td>
                        <td>{item.action}</td>
                        <td>
                          {item.resourceType} {item.resourceId}
                        </td>
                        <td>{item.actorId ?? 'Sistema'}</td>
                        <td>{item.outcome}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
