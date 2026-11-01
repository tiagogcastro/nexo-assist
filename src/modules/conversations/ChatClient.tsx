'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { ticketContentSchema } from '@/modules/tickets/ticket-schema';
import { formatPriority, formatStatus } from '@/modules/tickets/ticket-labels';

type Conversation = {
  id: string;
  title: string;
  state: string;
  messageCount: number;
  updatedAt: string;
};
type Message = { id: string; role: string; content: string; createdAt: string };
type Ticket = {
  id: string;
  code: string;
  title: string;
  description: string;
  type: 'INC' | 'REQ';
  category: z.infer<typeof ticketContentSchema>['category'];
  priority: string;
  status: string;
  dueAt: string;
};
type Draft = {
  id: string;
  action: string;
  payload: z.infer<typeof ticketContentSchema>;
  priority: string | null;
  dueAt: string | null;
  expiresAt: string;
  consumedAt: string | null;
};
type ApiResult<T> =
  { data: T; error: null } | { data: null; error: { code: string; message: string } };

async function getData<T>(url: string): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    const body = await response.json();
    return response.ok ? { data: body.data, error: null } : { data: null, error: body.error };
  } catch {
    return { data: null, error: { code: 'NETWORK_ERROR', message: 'Falha de conexão.' } };
  }
}

async function postData<T>(url: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await response.json();
    return response.ok ? { data: json.data, error: null } : { data: null, error: json.error };
  } catch {
    return { data: null, error: { code: 'NETWORK_ERROR', message: 'Falha de conexão.' } };
  }
}

function DraftForm({
  conversationId,
  ticket,
  onSaved,
}: {
  conversationId: string;
  ticket: Ticket | null;
  onSaved: () => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const form = useForm<z.infer<typeof ticketContentSchema>>({
    resolver: zodResolver(ticketContentSchema),
    defaultValues: {
      title: ticket?.title ?? '',
      description: ticket?.description ?? '',
      type: ticket?.type ?? 'INC',
      category: ticket?.category ?? 'Outros',
      teamBlocked: false,
      personBlocked: false,
      sameDayCommitment: false,
      hasWorkaround: false,
    },
  });

  async function submit(values: z.infer<typeof ticketContentSchema>) {
    setBusy(true);
    setError('');
    const result = await postData('/api/v1/ticket-drafts', {
      ...values,
      conversationId,
      ...(ticket ? { ticketId: ticket.id } : {}),
    });
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    onSaved();
  }

  return (
    <form className="draft-form" onSubmit={form.handleSubmit(submit)}>
      <h3>{ticket ? 'Complementar chamado' : 'Preparar chamado'}</h3>
      <p>Confira os dados. Nenhum chamado será alterado até você confirmar o rascunho.</p>
      <label>
        Título
        <input {...form.register('title')} placeholder="Resuma o problema" />
      </label>
      <label>
        Descrição
        <textarea
          {...form.register('description')}
          rows={3}
          placeholder="Explique o que aconteceu e desde quando"
        />
      </label>
      <div className="form-two">
        <label>
          Tipo
          <select {...form.register('type')}>
            <option value="INC">Incidente</option>
            <option value="REQ">Requisição</option>
          </select>
        </label>
        <label>
          Categoria
          <select {...form.register('category')}>
            <option>Acesso</option>
            <option>Rede e VPN</option>
            <option>Hardware</option>
            <option>Software</option>
            <option>E-mail</option>
            <option>Outros</option>
          </select>
        </label>
      </div>
      <fieldset>
        <legend>Impacto e urgência</legend>
        <label>
          <input type="checkbox" {...form.register('teamBlocked')} /> Equipe ou empresa parada
        </label>
        <label>
          <input type="checkbox" {...form.register('personBlocked')} /> Não consigo trabalhar
        </label>
        <label>
          <input type="checkbox" {...form.register('sameDayCommitment')} /> Compromisso hoje
        </label>
        <label>
          <input type="checkbox" {...form.register('hasWorkaround')} /> Tenho alternativa temporária
        </label>
      </fieldset>
      {form.formState.errors.title && <p className="form-error">Título: mínimo de 8 caracteres.</p>}
      {form.formState.errors.description && (
        <p className="form-error">Descrição: mínimo de 15 caracteres.</p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="primary-button" type="submit" disabled={busy}>
        {busy ? 'Preparando...' : 'Preparar rascunho'}
      </button>
    </form>
  );
}

export function ChatClient() {
  const queryClient = useQueryClient();
  const [chosenId, setSelectedId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [streamText, setStreamText] = useState('');
  const [actions, setActions] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showDraftForm, setShowDraftForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [retryRequest, setRetryRequest] = useState<{ content: string; requestKey: string } | null>(
    null,
  );
  const conversationsQuery = useQuery({
    queryKey: ['conversations'],
    queryFn: () => getData<Conversation[]>('/api/v1/conversations'),
  });
  const conversations = conversationsQuery.data?.data ?? [];
  const activeId = chosenId ?? conversations[0]?.id ?? null;

  const detailsQuery = useQuery({
    queryKey: ['conversation', activeId],
    queryFn: () =>
      getData<{ conversation: Conversation; messages: Message[] }>(
        `/api/v1/conversations/${activeId}`,
      ),
    enabled: Boolean(activeId),
    refetchInterval: 5000,
  });
  const ticketsQuery = useQuery({
    queryKey: ['tickets'],
    queryFn: () => getData<Ticket[]>('/api/v1/tickets'),
  });
  const draftsQuery = useQuery({
    queryKey: ['drafts', activeId],
    queryFn: () => getData<Draft[]>(`/api/v1/ticket-drafts?conversationId=${activeId}`),
    enabled: Boolean(activeId),
    refetchInterval: 5000,
  });
  const details = detailsQuery.data?.data;
  const tickets = ticketsQuery.data?.data ?? [];
  const drafts = draftsQuery.data?.data ?? [];
  const activeDraft = drafts.find(
    (draft) => !draft.consumedAt && new Date(draft.expiresAt) > new Date(),
  );

  async function createNewConversation() {
    setError('');
    const result = await postData<Conversation>('/api/v1/conversations');
    if (result.error) {
      setError(result.error.message);
      return;
    }

    setSelectedId(result.data.id);
    await queryClient.invalidateQueries({ queryKey: ['conversations'] });
  }

  async function confirmDraft() {
    if (!activeDraft) {
      return;
    }

    setBusy(true);
    const result = await postData<{ code: string }>(
      `/api/v1/ticket-drafts/${activeDraft.id}/confirm`,
    );
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    setError(`Chamado ${result.data.code} confirmado.`);
    await queryClient.invalidateQueries({ queryKey: ['drafts', activeId] });
    await queryClient.invalidateQueries({ queryKey: ['tickets'] });
    setShowDraftForm(false);
  }

  async function cancelDraft() {
    if (!activeDraft) {
      return;
    }

    const response = await fetch(`/api/v1/ticket-drafts/${activeDraft.id}`, { method: 'DELETE' });
    if (!response.ok) {
      setError('Não foi possível cancelar o rascunho.');
      return;
    }

    setError('Rascunho cancelado; nenhum chamado foi alterado.');
    await queryClient.invalidateQueries({ queryKey: ['drafts', activeId] });
  }

  async function requestHuman() {
    if (!activeId) {
      return;
    }

    const result = await postData(`/api/v1/conversations/${activeId}/handoffs`, {
      summary: content || 'Funcionário solicitou atendimento humano.',
    });
    if (result.error) {
      setError(result.error.message);
      return;
    }

    setError('Um analista foi solicitado. O assistente está pausado.');
    await queryClient.invalidateQueries({ queryKey: ['conversation', activeId] });
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeId || !content.trim()) {
      return;
    }

    await sendToAgent({ content: content.trim(), requestKey: crypto.randomUUID() });
  }

  async function sendToAgent(request: { content: string; requestKey: string }) {
    if (!activeId) {
      return;
    }

    setBusy(true);
    setError('');
    setStreamText('');
    setActions([]);
    setRetryRequest(null);
    let failed = false;

    try {
      const response = await fetch(`/api/v1/conversations/${activeId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!response.ok || !response.body) {
        const body = await response.json();
        setError(body.error?.message ?? 'Não foi possível enviar a mensagem.');
        setRetryRequest(request);
        setBusy(false);
        return;
      }

      setContent('');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          const name = part.match(/^event: (.+)$/m)?.[1];
          const payload = part.match(/^data: (.+)$/m)?.[1];
          if (!name || !payload) {
            continue;
          }

          const data = JSON.parse(payload);
          if (name === 'delta') {
            setStreamText((current) => current + data.text);
          }
          if (name === 'action') {
            setActions((current) => [...current, data.name]);
          }
          if (name === 'error') {
            setError(data.message);
            failed = true;
          }
        }
      }
    } catch {
      setError('A conexão com o assistente falhou.');
      failed = true;
    }

    if (failed) {
      setRetryRequest(request);
    }

    setBusy(false);
    setStreamText('');
    await queryClient.invalidateQueries({ queryKey: ['conversation', activeId] });
    await queryClient.invalidateQueries({ queryKey: ['drafts', activeId] });
    await queryClient.invalidateQueries({ queryKey: ['conversations'] });
  }

  return (
    <div className="chat-columns">
      <section className="chat-section">
        <header className="chat-heading">
          <div>
            <p className="eyebrow">ATENDIMENTO</p>
            <h1>Como podemos ajudar?</h1>
            <p>Descreva sua dúvida ou problema de TI.</p>
          </div>
          <button type="button" className="secondary-button" onClick={createNewConversation}>
            + Nova conversa
          </button>
        </header>
        <div className="conversation-tabs">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              className={conversation.id === activeId ? 'selected' : ''}
              onClick={() => setSelectedId(conversation.id)}
            >
              {conversation.title}
            </button>
          ))}
        </div>
        <div className="chat-history" aria-live="polite">
          {!activeId && (
            <div className="empty-state">
              <h2>Uma conversa pode resolver.</h2>
              <p>
                Inicie um atendimento para consultar seus chamados, buscar ajuda ou falar com um
                analista.
              </p>
              <button className="primary-button" onClick={createNewConversation}>
                Iniciar atendimento
              </button>
            </div>
          )}
          {details?.messages.map((message) => (
            <div key={message.id} className={`message ${message.role}`}>
              <small>
                {message.role === 'employee'
                  ? 'Você'
                  : message.role === 'analyst'
                    ? 'Analista'
                    : 'Nexo Assist'}
              </small>
              <p>{message.content}</p>
            </div>
          ))}
          {busy && streamText && (
            <div className="message agent">
              <small>Nexo Assist · {actions.join(' · ')}</small>
              <p>{streamText}</p>
            </div>
          )}
          {details?.conversation.state === 'awaiting_analyst' && (
            <div className="handoff-banner">Aguardando atendente. O assistente está pausado.</div>
          )}
          {details?.conversation.state === 'analyst_active' && (
            <div className="handoff-banner">Um analista está atendendo esta conversa.</div>
          )}
        </div>
        {error && (
          <div className="chat-notice" role="status">
            {error}
            {retryRequest && details?.conversation.state === 'agent_active' && (
              <button type="button" onClick={() => sendToAgent(retryRequest)} disabled={busy}>
                Tentar novamente
              </button>
            )}
          </div>
        )}
        <div className="chat-composer">
          <form onSubmit={sendMessage}>
            <input
              aria-label="Sua mensagem"
              placeholder="Descreva o que está acontecendo..."
              value={content}
              onChange={(event) => setContent(event.target.value)}
              disabled={!activeId || busy || details?.conversation.state !== 'agent_active'}
            />
            <button
              type="submit"
              disabled={
                !activeId ||
                busy ||
                !content.trim() ||
                details?.conversation.state !== 'agent_active'
              }
            >
              Enviar ↑
            </button>
          </form>
          <div className="chat-actions">
            <button
              type="button"
              onClick={() => {
                setSelectedTicket(null);
                setShowDraftForm(true);
              }}
              disabled={!activeId || details?.conversation.state !== 'agent_active'}
            >
              Abrir chamado
            </button>
            <button
              type="button"
              onClick={requestHuman}
              disabled={!activeId || details?.conversation.state !== 'agent_active'}
            >
              Falar com analista
            </button>
            <span>{details?.conversation.messageCount ?? 0}/30 mensagens</span>
          </div>
        </div>
      </section>
      <aside className="ticket-panel">
        <h2>Seus chamados</h2>
        <p className="panel-subtitle">Acompanhe prazos e atualizações</p>
        {ticketsQuery.data?.error && (
          <p className="form-error">{ticketsQuery.data.error.message}</p>
        )}
        {tickets.length === 0 && <p>Nenhum chamado encontrado.</p>}
        {tickets.map((ticket) => (
          <button
            type="button"
            className="ticket-card"
            key={ticket.id}
            onClick={() => {
              setSelectedTicket(ticket);
              setShowDraftForm(true);
            }}
          >
            <span className="ticket-code">{ticket.code}</span>
            <strong>{ticket.title}</strong>
            <small>
              {ticket.category} · {formatPriority(ticket.priority)} · {formatStatus(ticket.status)}
            </small>
            <small
              className={
                ticket.status !== 'resolved' && new Date(ticket.dueAt) < new Date() ? 'overdue' : ''
              }
            >
              {ticket.status === 'resolved'
                ? 'Concluído'
                : new Date(ticket.dueAt) < new Date()
                  ? 'Prazo vencido'
                  : `Prazo: ${new Date(ticket.dueAt).toLocaleString('pt-BR')}`}
            </small>
          </button>
        ))}
        {showDraftForm && activeId && (
          <DraftForm
            key={`${activeId}:${selectedTicket?.id ?? 'new'}`}
            conversationId={activeId}
            ticket={selectedTicket}
            onSaved={() => {
              setShowDraftForm(false);
              queryClient.invalidateQueries({ queryKey: ['drafts', activeId] });
            }}
          />
        )}
        {activeDraft && (
          <div className="draft-review">
            <h3>Rascunho para confirmação</h3>
            <p>
              {activeDraft.action === 'create'
                ? 'Criar'
                : activeDraft.action === 'reopen'
                  ? 'Reabrir'
                  : 'Atualizar'}{' '}
              chamado: <strong>{activeDraft.payload.title}</strong>
            </p>
            <p>{activeDraft.payload.description}</p>
            <p>
              {activeDraft.payload.type} · {activeDraft.payload.category} ·{' '}
              {activeDraft.priority ? formatPriority(activeDraft.priority) : 'Prioridade pendente'}
            </p>
            <p>
              Prazo estimado:{' '}
              {activeDraft.dueAt
                ? new Date(activeDraft.dueAt).toLocaleString('pt-BR')
                : 'Indisponível'}
            </p>
            <div className="draft-actions">
              <button
                type="button"
                className="primary-button"
                disabled={busy}
                onClick={confirmDraft}
              >
                Confirmar
              </button>
              <button type="button" onClick={cancelDraft}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
