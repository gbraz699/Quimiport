import type { RequestHandler } from 'express';
import { ApplicationError } from '../../application/errors/ApplicationError.js';

export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(new ApplicationError('Rota não encontrada.', 404, 'ROTA_NAO_ENCONTRADA'));
};
