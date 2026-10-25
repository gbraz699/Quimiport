import express from 'express';
import type { CargaQuimicaRepository } from './domain/repositories/CargaQuimicaRepository.js';
import type { ProdutoQuimicoRepository } from './domain/repositories/ProdutoQuimicoRepository.js';
import { getPrismaClient } from './infrastructure/database/prisma.js';
import { PrismaCargaQuimicaRepository } from './infrastructure/repositories/PrismaCargaQuimicaRepository.js';
import { PrismaProdutoQuimicoRepository } from './infrastructure/repositories/PrismaProdutoQuimicoRepository.js';
import { errorHandler } from './interfaces/middleware/errorHandler.js';
import { notFoundHandler } from './interfaces/middleware/notFoundHandler.js';
import { requestLogger } from './interfaces/middleware/requestLogger.js';
import { cargaQuimicaRoutes } from './interfaces/routes/cargaQuimica.routes.js';
import { docsRoutes } from './interfaces/docs/docs.routes.js';
import { healthRoutes } from './interfaces/routes/health.routes.js';
import { produtoQuimicoRoutes } from './interfaces/routes/produtoQuimico.routes.js';

export function createApp(
  produtoRepository: ProdutoQuimicoRepository = new PrismaProdutoQuimicoRepository(getPrismaClient()),
  cargaRepository: CargaQuimicaRepository = new PrismaCargaQuimicaRepository(getPrismaClient()),
) {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestLogger);
  app.use(express.json());
  app.use(healthRoutes);
  app.use(docsRoutes);
  app.use(produtoQuimicoRoutes(produtoRepository));
  app.use(cargaQuimicaRoutes(cargaRepository, produtoRepository));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
