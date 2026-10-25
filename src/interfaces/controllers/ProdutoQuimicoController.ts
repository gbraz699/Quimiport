import type { Request, Response } from 'express';
import { ProdutoQuimicoService } from '../../application/produtos-quimicos/ProdutoQuimicoService.js';
import { parseProdutoId, parseProdutoQuimicoInput } from '../validation/produtoQuimicoInput.js';

export class ProdutoQuimicoController {
  constructor(private readonly service: ProdutoQuimicoService) {}

  create = async (request: Request, response: Response): Promise<void> => {
    const produto = await this.service.create(parseProdutoQuimicoInput(request.body));
    response.status(201).json(produto);
  };

  list = async (_request: Request, response: Response): Promise<void> => {
    response.status(200).json(await this.service.list());
  };

  getById = async (request: Request, response: Response): Promise<void> => {
    response.status(200).json(await this.service.getById(parseProdutoId(request.params.id)));
  };

  update = async (request: Request, response: Response): Promise<void> => {
    const produto = await this.service.update(
      parseProdutoId(request.params.id),
      parseProdutoQuimicoInput(request.body),
    );
    response.status(200).json(produto);
  };

  inactivate = async (request: Request, response: Response): Promise<void> => {
    response.status(200).json(await this.service.inactivate(parseProdutoId(request.params.id)));
  };
}
