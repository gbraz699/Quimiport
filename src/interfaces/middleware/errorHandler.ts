import type { ErrorRequestHandler } from 'express';
import { ApplicationError } from '../../application/errors/ApplicationError.js';
import { logger } from '../../shared/logger.js';

export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, _next) => {
  if (error instanceof ApplicationError) {
    logger.warn('Requisição rejeitada', {
      method: request.method, path: request.path, status: error.statusCode, code: error.code,
    });
    response.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    logger.warn('Requisição rejeitada', {
      method: request.method, path: request.path, status: 400, code: 'INVALID_JSON',
    });
    response.status(400).json({ error: { code: 'INVALID_JSON', message: 'JSON inválido.' } });
    return;
  }
  logger.error('Erro inesperado', {
    method: request.method,
    path: request.path,
    errorName: error instanceof Error ? error.name : typeof error,
    errorCode: typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code : undefined,
  });
  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } });
};
