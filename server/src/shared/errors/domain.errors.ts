/**
 * Camada de erros de domínio.
 * O servidor HTTP traduz estes erros em respostas apropriadas — os casos de uso
 * lançam apenas estes tipos, mantendo as regras de negócio independentes de framework.
 */

export type DomainErrorName =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'UNPROCESSABLE';

export class DomainError extends Error {
  public readonly name: DomainErrorName;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(name: DomainErrorName, statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = name;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends DomainError {
  constructor(message = 'Dados inválidos.', details?: unknown) {
    super('VALIDATION_ERROR', 400, message, details);
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'Recurso não encontrado.') {
    super('NOT_FOUND', 404, message);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Acesso negado para o papel do usuário.') {
    super('FORBIDDEN', 403, message);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details?: unknown) {
    super('CONFLICT', 409, message, details);
  }
}

export class UnprocessableEntityError extends DomainError {
  constructor(message: string, details?: unknown) {
    super('UNPROCESSABLE', 422, message, details);
  }
}
