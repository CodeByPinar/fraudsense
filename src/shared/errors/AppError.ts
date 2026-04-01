export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly context?: Record<string, unknown>;

  public constructor(
    message: string,
    code: string,
    statusCode: number,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
  }
}

export class DomainError extends AppError {
  public constructor(message: string, context?: Record<string, unknown>) {
    super(message, "DOMAIN_ERROR", 422, context);
    this.name = "DomainError";
  }
}

export class InfraError extends AppError {
  public constructor(message: string, context?: Record<string, unknown>) {
    super(message, "INFRA_ERROR", 503, context);
    this.name = "InfraError";
  }
}

export class ValidationError extends AppError {
  public constructor(message: string, context?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", 400, context);
    this.name = "ValidationError";
  }
}

export class ConflictError extends AppError {
  public constructor(message: string, context?: Record<string, unknown>) {
    super(message, "CONFLICT", 409, context);
    this.name = "ConflictError";
  }
}

export class AuthError extends AppError {
  public constructor(message: string, statusCode = 401, context?: Record<string, unknown>) {
    super(message, "AUTH_ERROR", statusCode, context);
    this.name = "AuthError";
  }
}
