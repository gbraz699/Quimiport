import { ApplicationError } from '../errors/ApplicationError.js';
import { ProdutoStatus, type ProdutoQuimico } from '../../domain/entities/ProdutoQuimico.js';
import type { ProdutoQuimicoRepository } from '../../domain/repositories/ProdutoQuimicoRepository.js';
import { logger } from '../../shared/logger.js';

export interface ProdutoQuimicoInput {
  nome: string;
  descricao: string | null;
  numeroOnu: string | null;
  classeRisco: string;
  grupoCompatibilidade: string | null;
  status?: ProdutoStatus;
}

export class ProdutoQuimicoService {
  constructor(private readonly repository: ProdutoQuimicoRepository) {}

  async create(input: ProdutoQuimicoInput): Promise<ProdutoQuimico> {
    this.validate(input);
    if (input.status === ProdutoStatus.INATIVO) {
      throw new ApplicationError('Produto deve ser criado como ATIVO', 409, 'PRODUTO_STATUS_INVALIDO');
    }
    const produto = await this.repository.create({
      nome: input.nome.trim(),
      descricao: input.descricao,
      numeroOnu: input.numeroOnu,
      classeRisco: input.classeRisco.trim(),
      grupoCompatibilidade: input.grupoCompatibilidade,
      status: ProdutoStatus.ATIVO,
    });
    logger.info('Produto químico criado', { produtoId: produto.id });
    return produto;
  }

  list(): Promise<ProdutoQuimico[]> {
    return this.repository.findAll();
  }

  async getById(id: string): Promise<ProdutoQuimico> {
    const produto = await this.repository.findById(id);
    if (!produto) throw new ApplicationError('Produto químico não encontrado', 404, 'PRODUTO_NAO_ENCONTRADO');
    return produto;
  }

  async update(id: string, input: ProdutoQuimicoInput): Promise<ProdutoQuimico> {
    this.validate(input);
    const existing = await this.getById(id);
    return this.repository.update({
      ...existing,
      nome: input.nome.trim(),
      descricao: input.descricao,
      numeroOnu: input.numeroOnu,
      classeRisco: input.classeRisco.trim(),
      grupoCompatibilidade: input.grupoCompatibilidade,
      status: input.status ?? existing.status,
    });
  }

  async inactivate(id: string): Promise<ProdutoQuimico> {
    const existing = await this.getById(id);
    if (existing.status === ProdutoStatus.INATIVO) return existing;
    return this.repository.update({ ...existing, status: ProdutoStatus.INATIVO });
  }

  private validate(input: ProdutoQuimicoInput): void {
    if (typeof input.nome !== 'string' || !input.nome.trim()) {
      throw new ApplicationError('Nome é obrigatório', 400);
    }
    if (typeof input.classeRisco !== 'string' || !input.classeRisco.trim()) {
      throw new ApplicationError('Classe de risco é obrigatória', 400);
    }
    if (input.status !== undefined && !Object.values(ProdutoStatus).includes(input.status)) {
      throw new ApplicationError('Status inválido', 400, 'STATUS_INVALIDO');
    }
  }
}
