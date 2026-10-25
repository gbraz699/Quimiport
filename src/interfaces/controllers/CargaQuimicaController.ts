import type { Request, Response } from 'express';
import { CargaQuimicaService } from '../../application/cargas-quimicas/CargaQuimicaService.js';
import { parseCargaQuimicaInput } from '../validation/cargaQuimicaInput.js';
import { parseProdutoId } from '../validation/produtoQuimicoInput.js';

export class CargaQuimicaController {
  constructor(private readonly service: CargaQuimicaService) {}

  create = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(await this.service.create(parseCargaQuimicaInput(request.body)));
  };

  list = async (_request: Request, response: Response): Promise<void> => {
    response.status(200).json(await this.service.list());
  };

  getById = async (request: Request, response: Response): Promise<void> => {
    response.status(200).json(await this.service.getById(parseProdutoId(request.params.id)));
  };

  changeStatus = async (request: Request, response: Response): Promise<void> => {
    response.status(200).json(await this.service.changeStatus(
      parseProdutoId(request.params.id),
      request.body,
    ));
  };

  block = async (request: Request, response: Response): Promise<void> => {
    response.status(200).json(await this.service.block(parseProdutoId(request.params.id)));
  };

  release = async (request: Request, response: Response): Promise<void> => {
    response.status(200).json(await this.service.release(parseProdutoId(request.params.id)));
  };

  cancel = async (request: Request, response: Response): Promise<void> => {
    response.status(200).json(await this.service.cancel(parseProdutoId(request.params.id)));
  };
}
