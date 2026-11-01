import { NextResponse } from 'next/server';
import type { AppError, Result } from '@/lib/result';
import { failure, success } from '@/lib/result';

const ERROR_STATUS: Record<string, number> = {
  UNAUTHENTICATED: 401,
  ACCESS_DENIED: 403,
  TICKET_NOT_FOUND: 404,
  CONVERSATION_NOT_FOUND: 404,
  DRAFT_NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  DUPLICATE_TICKET: 409,
  DRAFT_EXPIRED: 409,
  CONVERSATION_PAUSED: 409,
  CONVERSATION_LIMIT: 409,
  LEGACY_SERVICE_UNAVAILABLE: 503,
  AI_PROVIDER_UNAVAILABLE: 503,
  RATE_LIMITED: 429,
};

export function errorResponse(error: AppError, requestId = crypto.randomUUID()) {
  return NextResponse.json({ error, requestId }, { status: ERROR_STATUS[error.code] ?? 500 });
}

export function resultResponse<T>(result: Result<T>) {
  if (result.error) {
    return errorResponse(result.error);
  }

  return NextResponse.json({ data: result.data });
}

export async function readJson(request: Request): Promise<Result<unknown>> {
  try {
    return success(await request.json());
  } catch {
    return failure('VALIDATION_ERROR', 'JSON inválido.');
  }
}
