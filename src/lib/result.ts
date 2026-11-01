export type AppError = {
  code: string;
  message: string;
  details?: unknown;
};

export type Result<T, E extends AppError = AppError> =
  { data: T; error: null } | { data: null; error: E };

export function failure(code: string, message: string, details?: unknown): Result<never> {
  return { data: null, error: { code, message, details } };
}

export function success<T>(data: T): Result<T> {
  return { data, error: null };
}
