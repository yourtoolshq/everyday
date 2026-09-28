/**
 * Transport-neutral application errors.
 *
 * Map these at HTTP/tRPC boundaries. Do not import framework types here.
 */
export type AppErrorCode =
  | "invalid_input"
  | "not_found"
  | "conflict"
  | "failed_precondition"
  | "unexpected";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: AppErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function invalidInput(
  message: string,
  details?: Readonly<Record<string, unknown>>,
) {
  return new AppError("invalid_input", message, details);
}

export function notFound(
  message: string,
  details?: Readonly<Record<string, unknown>>,
) {
  return new AppError("not_found", message, details);
}

export function conflict(
  message: string,
  details?: Readonly<Record<string, unknown>>,
) {
  return new AppError("conflict", message, details);
}

export function failedPrecondition(
  message: string,
  details?: Readonly<Record<string, unknown>>,
) {
  return new AppError("failed_precondition", message, details);
}

export function unexpected(
  message: string,
  details?: Readonly<Record<string, unknown>>,
) {
  return new AppError("unexpected", message, details);
}
