export type AppErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "INVALID_STATE";

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "auth.required") {
    super("UNAUTHENTICATED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "errors.forbidden", details?: Record<string, unknown>) {
    super("FORBIDDEN", message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "errors.notFound") {
    super("NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "errors.conflict") {
    super("CONFLICT", message);
  }
}

export class InvalidStateError extends AppError {
  constructor(message = "errors.invalidState") {
    super("INVALID_STATE", message);
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
