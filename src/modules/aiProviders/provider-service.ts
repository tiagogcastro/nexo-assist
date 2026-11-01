import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { aiModels, aiProviders, auditLogs } from '@/db/schema/app';
import { failure, success } from '@/lib/result';
import { requirePermission } from '@/modules/accessControl/permissions';
import { decryptProviderKey, encryptProviderKey } from '@/modules/aiProviders/crypto';
import { z } from 'zod';

export type ProviderKind = 'deepseek' | 'openai' | 'anthropic' | 'openrouter';

export async function testProviderConnection({
  kind,
  apiKey,
  modelId,
}: {
  kind: ProviderKind;
  apiKey: string;
  modelId: string;
}) {
  const url =
    kind === 'deepseek'
      ? 'https://api.deepseek.com/models'
      : kind === 'anthropic'
        ? 'https://api.anthropic.com/v1/models'
        : kind === 'openrouter'
          ? 'https://openrouter.ai/api/v1/models'
          : 'https://api.openai.com/v1/models';
  const headers = new Headers();
  if (kind === 'anthropic') {
    headers.set('x-api-key', apiKey);
    headers.set('anthropic-version', '2023-06-01');
  } else {
    headers.set('Authorization', `Bearer ${apiKey}`);
  }

  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });
    if (!response.ok) {
      return failure('PROVIDER_TEST_FAILED', 'A credencial foi recusada pelo provedor.');
    }

    const body: unknown = await response.json();
    const parsed = z.object({ data: z.array(z.object({ id: z.string() })) }).safeParse(body);
    if (!parsed.success || !parsed.data.data.some((model) => model.id === modelId)) {
      return failure('MODEL_UNAVAILABLE', 'O modelo informado não consta na conta do provedor.');
    }

    return success({
      modelId,
      verifiedAt: new Date(),
      toolSupport: kind === 'deepseek' ? 'documented' : 'unverified',
    });
  } catch {
    return failure('PROVIDER_TEST_FAILED', 'Não foi possível testar a conexão com o provedor.');
  }
}

export async function getActiveProvider() {
  try {
    const row = await db
      .select({
        kind: aiProviders.kind,
        encryptedKey: aiProviders.encryptedKey,
        modelId: aiModels.modelId,
      })
      .from(aiModels)
      .innerJoin(aiProviders, eq(aiModels.providerId, aiProviders.id))
      .where(and(eq(aiModels.active, true), eq(aiProviders.active, true)))
      .limit(1);

    if (row.length) {
      const key = decryptProviderKey(row[0].encryptedKey);
      if (key.error) {
        return key;
      }

      return success({ kind: row[0].kind, modelId: row[0].modelId, apiKey: key.data });
    }

    if (process.env.DEEPSEEK_API_KEY) {
      return success({
        kind: 'deepseek',
        modelId: 'deepseek-flash',
        apiKey: process.env.DEEPSEEK_API_KEY,
      });
    }

    return failure('AI_PROVIDER_UNAVAILABLE', 'Nenhum modelo de IA está configurado.');
  } catch {
    return failure('AI_PROVIDER_UNAVAILABLE', 'Não foi possível consultar a configuração de IA.');
  }
}

export async function listProviderSettings(userId: string) {
  const permitted = await requirePermission({ userId, permission: 'providers:manage' });
  if (permitted.error) {
    return permitted;
  }

  try {
    const providers = await db
      .select({
        id: aiProviders.id,
        kind: aiProviders.kind,
        name: aiProviders.name,
        active: aiProviders.active,
        createdAt: aiProviders.createdAt,
      })
      .from(aiProviders);
    const models = await db.select().from(aiModels);
    return success({
      providers: providers.map((provider) => ({ ...provider, key: '••••••••' })),
      models,
    });
  } catch {
    return failure('PROVIDER_UNAVAILABLE', 'Não foi possível consultar os provedores.');
  }
}

export async function saveProvider({
  userId,
  kind,
  name,
  apiKey,
  modelId,
  requestId,
}: {
  userId: string;
  kind: ProviderKind;
  name: string;
  apiKey: string;
  modelId: string;
  requestId: string;
}) {
  const permitted = await requirePermission({ userId, permission: 'providers:manage' });
  if (permitted.error) {
    return permitted;
  }

  const tested = await testProviderConnection({ kind, apiKey, modelId });
  if (tested.error) {
    return tested;
  }

  const encrypted = encryptProviderKey(apiKey);
  if (encrypted.error) {
    return encrypted;
  }

  try {
    return await db.transaction(async (tx) => {
      await tx.update(aiModels).set({ active: false });
      await tx.update(aiProviders).set({ active: false });
      const [provider] = await tx
        .insert(aiProviders)
        .values({ kind, name, encryptedKey: encrypted.data, active: true })
        .returning();
      const [model] = await tx
        .insert(aiModels)
        .values({ providerId: provider.id, modelId, active: true })
        .returning();
      await tx.insert(auditLogs).values({
        actorId: userId,
        action: 'provider.create',
        resourceType: 'ai_provider',
        resourceId: provider.id,
        requestId,
        outcome: 'committed',
      });
      return success({ providerId: provider.id, modelId: model.id });
    });
  } catch {
    return failure('PROVIDER_UNAVAILABLE', 'Não foi possível salvar o provedor.');
  }
}

export async function removeProvider({
  userId,
  providerId,
  requestId,
}: {
  userId: string;
  providerId: string;
  requestId: string;
}) {
  const permitted = await requirePermission({ userId, permission: 'providers:manage' });
  if (permitted.error) {
    return permitted;
  }

  try {
    return await db.transaction(async (tx) => {
      const [provider] = await tx
        .select({ id: aiProviders.id })
        .from(aiProviders)
        .where(eq(aiProviders.id, providerId))
        .limit(1);
      if (!provider) {
        return failure('PROVIDER_NOT_FOUND', 'Provedor não encontrado.');
      }

      await tx.delete(aiModels).where(eq(aiModels.providerId, providerId));
      await tx.delete(aiProviders).where(eq(aiProviders.id, providerId));
      await tx
        .insert(auditLogs)
        .values({
          actorId: userId,
          action: 'provider.remove',
          resourceType: 'ai_provider',
          resourceId: providerId,
          requestId,
          outcome: 'committed',
        });
      return success({ providerId });
    });
  } catch {
    return failure('PROVIDER_UNAVAILABLE', 'Não foi possível remover o provedor.');
  }
}
