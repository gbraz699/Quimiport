import { Router } from 'express';
import { ProdutoQuimicoService } from '../../application/produtos-quimicos/ProdutoQuimicoService.js';
import type { ProdutoQuimicoRepository } from '../../domain/repositories/ProdutoQuimicoRepository.js';
import { ProdutoQuimicoController } from '../controllers/ProdutoQuimicoController.js';

export function produtoQuimicoRoutes(repository: ProdutoQuimicoRepository): Router {
  const router = Router();
  const controller = new ProdutoQuimicoController(new ProdutoQuimicoService(repository));

  router.post('/produtos-quimicos', controller.create);
  router.get('/produtos-quimicos', controller.list);
  router.get('/produtos-quimicos/:id', controller.getById);
  router.put('/produtos-quimicos/:id', controller.update);
  router.patch('/produtos-quimicos/:id/inativar', controller.inactivate);

  return router;
}
