'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { SignOutButton } from '@/components/layout/SignOutButton';
import { formatPriority, formatStatus } from '@/modules/tickets/ticket-labels';

type QueueItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  title: string;
  state: string;
  updatedAt: string;
};
type Message = { id: string; role: string; content: string; createdAt: string };
type Ticket = {
  id: string;
  code: string;
  title: string;
  priority: string;
  category: string;
  status: string;
  dueAt: string;
};
type Detail = {
  conversation: QueueItem;
  messages: Message[];
  tickets: Ticket[];
  handoff: { id: string; state: string } | null;
};

async function request<T>(
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

export function ConsoleClient() {
  const queryClient = useQueryClient();
  const [chosenId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const queueQuery = useQuery({
    queryKey: ['analystQueue'],
    queryFn: () => request<QueueItem[]>('/api/v1/analyst/conversations'),
    refetchInterval: () =>
      typeof document !== 'undefined' && document.visibilityState === 'visible' ? 4000 : false,
  });
  const queue = queueQuery.data?.data ?? [];
  const activeId = chosenId ?? queue[0]?.id ?? null;

  const detailQuery = useQuery({
    queryKey: ['analystConversation', activeId],
    queryFn: () => request<Detail>(`/api/v1/analyst/conversations/${activeId}`),
    enabled: Boolean(activeId),
    refetchInterval: () =>
      typeof document !== 'undefined' && document.visibilityState === 'visible' ? 4000 : false,
  });
  const detail = detailQuery.data?.data;
  const visibleQueue = queue.filter(
    (item) =>
      (filter === 'all' || item.state === filter) &&
      `${item.employeeName} ${item.title}`.toLowerCase().includes(search.toLowerCase()),
  );

  async function transition(action: 'claim' | 'return' | 'close') {
    if (!detail?.handoff) {
      return;
    }

    setBusy(true);
    const result = await request(`/api/v1/handoffs/${detail.handoff.id}/${action}`, 'POST');
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }

    setError('');
    await queryClient.invalidateQueries({ queryKey: ['analystQueue'] });
    await queryClient.invalidateQueries({ queryKey: ['analystConversation', activeId] });
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeId || !content.trim()) {
      return;
    }

    setBusy(true);
    const result = await request(`/api/v1/analyst/conversations/${activeId}/messages`, 'POST', {
      content: content.trim(),
      requestKey: crypto.randomUUID(),
    });
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }

    setContent('');
    setError('');
    await queryClient.invalidateQueries({ queryKey: ['analystConversation', activeId] });
  }

  return (
    <div className="console-layout">
      <aside className="console-rail">
        <Link className="brand-mark" href="/console">
          N
        </Link>
        <Link className="rail-active" href="/console" aria-label="Conversas">
          ☰
        </Link>
        <div className="rail-bottom">
          <Link href="/admin" aria-label="Administração">
            ⚙
          </Link>
          <SignOutButton />
        </div>
      </aside>
      <aside className="console-list">
        <header>
          <div className="console-title">
            <h1>Conversas</h1>
            <span>{queue.length}</span>
          </div>
          <input
            aria-label="Pesquisar conversa ou chamado"
            placeholder="Pesquisar conversa ou chamado"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="console-filters">
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
              Todas
            </button>
            <button
              className={filter === 'awaiting_analyst' ? 'active' : ''}
              onClick={() => setFilter('awaiting_analyst')}
            >
              Aguardando
            </button>
            <button
              className={filter === 'analyst_active' ? 'active' : ''}
              onClick={() => setFilter('analyst_active')}
            >
              Em atendimento
            </button>
          </div>
        </header>
        <div className="queue-items">
          {visibleQueue.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`queue-item ${activeId === item.id ? 'selected' : ''}`}
              onClick={() => setSelectedId(item.id)}
            >
              <span className="avatar">
                {item.employeeName
                  .split(' ')
                  .map((word) => word[0])
                  .slice(0, 2)
                  .join('')}
              </span>
              <span>
                <strong>{item.employeeName}</strong>
                <small>{item.title}</small>
                <em>
                  {item.state === 'awaiting_analyst' ? 'Aguardando atendente' : 'Em atendimento'}
                </em>
              </span>
            </button>
          ))}
          {visibleQueue.length === 0 && <p className="queue-empty">Nenhuma conversa nesta fila.</p>}
        </div>
      </aside>
      <section className="console-conversation">
        <header>
          <span className="avatar">
            {detail?.conversation.employeeName
              .split(' ')
              .map((word) => word[0])
              .slice(0, 2)
              .join('') ?? '—'}
          </span>
          <div>
            <strong>{detail?.conversation.employeeName ?? 'Selecione uma conversa'}</strong>
            <small>
              {detail?.conversation.state === 'awaiting_analyst'
                ? 'Aguardando atendente'
                : detail?.conversation.state === 'analyst_active'
                  ? 'Atendimento assumido'
                  : ''}
            </small>
          </div>
          <div className="console-header-actions">
            {detail?.conversation.state === 'analyst_active' && (
              <>
                <button onClick={() => transition('return')} disabled={busy}>
                  Devolver ao agent
                </button>
                <button
                  className="close-button"
                  onClick={() => transition('close')}
                  disabled={busy}
                >
                  Encerrar atendimento
                </button>
              </>
            )}
          </div>
        </header>
        <div className="console-messages">
          {detail?.messages.map((message) => (
            <div key={message.id} className={`message ${message.role}`}>
              <small>
                {message.role === 'employee'
                  ? detail.conversation.employeeName
                  : message.role === 'analyst'
                    ? 'Você'
                    : 'Nexo Assist'}
              </small>
              <p>{message.content}</p>
            </div>
          ))}
          {detail?.conversation.state === 'awaiting_analyst' && (
            <div className="handoff-banner">
              O assistente está pausado. Assuma a conversa para responder.
            </div>
          )}
        </div>
        <div className="console-composer">
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {detail?.conversation.state === 'awaiting_analyst' ? (
            <button className="primary-button" onClick={() => transition('claim')} disabled={busy}>
              Assumir atendimento
            </button>
          ) : (
            <form onSubmit={sendMessage}>
              <input
                aria-label="Responder ao funcionário"
                placeholder="Escreva sua resposta..."
                value={content}
                onChange={(event) => setContent(event.target.value)}
                disabled={!detail || detail.conversation.state !== 'analyst_active'}
              />
              <button type="submit" disabled={!content.trim() || busy}>
                Enviar ↑
              </button>
            </form>
          )}
        </div>
      </section>
      <aside className="console-tickets">
        <header>
          <h2>Chamados de {detail?.conversation.employeeName.split(' ')[0] ?? 'funcionário'}</h2>
          <small>{detail?.tickets.length ?? 0} chamados</small>
        </header>
        <div className="console-ticket-body">
          {detail?.tickets.map((ticket) => (
            <div className="ticket-card" key={ticket.id}>
              <span className="ticket-code">{ticket.code}</span>
              <strong>{ticket.title}</strong>
              <small>
                {ticket.category} · {formatPriority(ticket.priority)}
              </small>
              <small>{formatStatus(ticket.status)}</small>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
