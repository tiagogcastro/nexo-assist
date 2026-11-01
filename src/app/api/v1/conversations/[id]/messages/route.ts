import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { agentDecisions, conversations, messages } from '@/db/schema/app';
import { getActor } from '@/modules/auth/actor';
import {
  appendAgentMessage,
  appendEmployeeMessage,
  getOwnConversation,
} from '@/modules/conversations/conversation-service';
import { getActiveProvider } from '@/modules/aiProviders/provider-service';
import { reserveAiRequest, finishAiRequest } from '@/modules/observability/usage-service';
import { createSupportAgent } from '@/mastra/agents/support-agent';
import { errorResponse, readJson, resultResponse } from '@/lib/http';

const schema = z.object({ content: z.string().trim().min(1).max(2000), requestKey: z.uuid() });

function event(name: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (actor.error) {
    return resultResponse(actor);
  }

  const { id } = await params;
  const body = await readJson(request);
  if (body.error) {
    return resultResponse(body);
  }

  const parsed = schema.safeParse(body.data);
  if (!z.uuid().safeParse(id).success || !parsed.success) {
    return errorResponse({ code: 'VALIDATION_ERROR', message: 'Mensagem inválida.' });
  }

  const provider = await getActiveProvider();
  if (provider.error) {
    return resultResponse(provider);
  }

  const reservation = await reserveAiRequest({
    actorId: actor.data.id,
    conversationId: id,
    provider: provider.data.kind,
    model: provider.data.modelId,
  });
  if (reservation.error) {
    return resultResponse(reservation);
  }

  const inserted = await appendEmployeeMessage({
    userId: actor.data.id,
    conversationId: id,
    content: parsed.data.content,
    requestKey: parsed.data.requestKey,
  });
  if (inserted.error) {
    await finishAiRequest({
      usageId: reservation.data,
      status: 'rejected',
      inputTokens: null,
      outputTokens: null,
      latencyMs: 0,
    });
    return resultResponse(inserted);
  }

  if (inserted.data.repeated) {
    const existingAnswer = await db.query.messages.findFirst({
      where: and(
        eq(messages.conversationId, id),
        eq(messages.requestKey, `${parsed.data.requestKey}:agent`),
      ),
    });
    if (inserted.data.message.content !== parsed.data.content || existingAnswer) {
      await finishAiRequest({
        usageId: reservation.data,
        status: 'rejected',
        inputTokens: null,
        outputTokens: null,
        latencyMs: 0,
      });
      return errorResponse({
        code: 'DUPLICATE_REQUEST',
        message: 'Esta mensagem já foi respondida.',
      });
    }
  }

  const history = await getOwnConversation({ userId: actor.data.id, conversationId: id });
  if (history.error) {
    await finishAiRequest({
      usageId: reservation.data,
      status: 'failed',
      inputTokens: null,
      outputTokens: null,
      latencyMs: 0,
    });
    return resultResponse(history);
  }

  const agent = createSupportAgent({
    userId: actor.data.id,
    conversationId: id,
    provider: provider.data,
  });
  const prompt = history.data.messages.map<
    { role: 'user'; content: string } | { role: 'assistant'; content: string }
  >((message) =>
    message.role === 'employee'
      ? { role: 'user', content: message.content }
      : { role: 'assistant', content: message.content },
  );
  const startedAt = Date.now();

  const responseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 30_000);
      request.signal.addEventListener('abort', () => abort.abort(), { once: true });
      let output = '';
      const actions: string[] = [];

      try {
        const stream = await agent.stream(prompt, { abortSignal: abort.signal });

        for await (const chunk of stream.fullStream) {
          const state = await db.query.conversations.findFirst({
            where: and(eq(conversations.id, id), eq(conversations.employeeId, actor.data.id)),
            columns: { state: true },
          });
          if (!state || state.state !== 'agent_active' || request.signal.aborted) {
            abort.abort();
            controller.enqueue(
              event('error', { code: 'CONVERSATION_PAUSED', message: 'O assistente foi pausado.' }),
            );
            await finishAiRequest({
              usageId: reservation.data,
              status: 'canceled',
              inputTokens: null,
              outputTokens: null,
              latencyMs: Date.now() - startedAt,
            });
            controller.close();
            return;
          }

          if (chunk.type === 'tool-call') {
            actions.push(chunk.payload.toolName);
            controller.enqueue(event('action', { name: chunk.payload.toolName }));
          }

          if (chunk.type === 'text-delta') {
            output += chunk.payload.text;
            controller.enqueue(event('delta', { text: chunk.payload.text }));
          }
        }

        const usage = await stream.usage;
        const saved = output.trim()
          ? await appendAgentMessage({
              conversationId: id,
              content: output.trim(),
              requestKey: `${parsed.data.requestKey}:agent`,
            })
          : null;
        if (saved?.error) {
          controller.enqueue(event('error', saved.error));
          await finishAiRequest({
            usageId: reservation.data,
            status: 'canceled',
            inputTokens: usage?.inputTokens ?? null,
            outputTokens: usage?.outputTokens ?? null,
            latencyMs: Date.now() - startedAt,
          });
          controller.close();
          return;
        }

        if (saved?.data) {
          await db.insert(agentDecisions).values({
            conversationId: id,
            messageId: saved.data.id,
            intent: 'it_support',
            action: actions.join(', ') || 'answer',
            evidence: { tools: actions },
            rationale: actions.length
              ? 'A resposta usou ferramentas do service desk.'
              : 'Resposta conversacional sem ferramenta.',
            confidence: actions.length ? 'supported' : 'unverified',
          });
        }

        await finishAiRequest({
          usageId: reservation.data,
          status: 'completed',
          inputTokens: usage?.inputTokens ?? null,
          outputTokens: usage?.outputTokens ?? null,
          latencyMs: Date.now() - startedAt,
          priceInputPerMillion: provider.data.priceInputPerMillion,
          priceOutputPerMillion: provider.data.priceOutputPerMillion,
        });
        controller.enqueue(event('done', { messageId: saved?.data?.id ?? null }));
        controller.close();
      } catch {
        await finishAiRequest({
          usageId: reservation.data,
          status: 'failed',
          inputTokens: null,
          outputTokens: null,
          latencyMs: Date.now() - startedAt,
        });
        controller.enqueue(
          event('error', {
            code: 'AI_PROVIDER_UNAVAILABLE',
            message: 'A IA está indisponível. Tente novamente.',
          }),
        );
        controller.close();
      } finally {
        clearTimeout(timeout);
      }
    },
  });

  return new Response(responseStream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
