import { Router } from 'express';
import type { CargaQuimicaRepository } from '../../domain/repositories/CargaQuimicaRepository.js';
import type { ProdutoQuimicoRepository } from '../../domain/repositories/ProdutoQuimicoRepository.js';
import { CargaQuimicaService } from '../../application/cargas-quimicas/CargaQuimicaService.js';
import { CargaQuimicaController } from '../controllers/CargaQuimicaController.js';

export function cargaQuimicaRoutes(cargas: CargaQuimicaRepository, produtos: ProdutoQuimicoRepository): Router {
  const router = Router();
  const controller = new CargaQuimicaController(new CargaQuimicaService(cargas, produtos));
  router.post('/cargas-quimicas', controller.create);
  router.get('/cargas-quimicas', controller.list);
  router.get('/cargas-quimicas/:id', controller.getById);
  router.patch('/cargas-quimicas/:id/status', controller.changeStatus);
  router.patch('/cargas-quimicas/:id/bloquear', controller.block);
  router.patch('/cargas-quimicas/:id/liberar', controller.release);
  router.patch('/cargas-quimicas/:id/cancelar', controller.cancel);
  return router;
}
