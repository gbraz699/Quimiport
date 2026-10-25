import type { RequestHandler } from 'express';
import { logger, type Logger } from '../../shared/logger.js';

export function createRequestLogger(output: Pick<Logger, 'info'>): RequestHandler {
  return (request, response, next) => {
    const started = performance.now();
    response.on('finish', () => {
      output.info('HTTP', {
        method: request.method,
        path: request.path,
        status: response.statusCode,
        durationMs: Math.round(performance.now() - started),
      });
    });
    next();
  };
}

export const requestLogger = createRequestLogger(logger);
