import { ApplicationError } from '../errors/ApplicationError.js';
import { CargaStatus, type CargaQuimicaDetalhada } from '../../domain/entities/CargaQuimica.js';
import { ProdutoStatus } from '../../domain/entities/ProdutoQuimico.js';
import { CargaCodigoDuplicadoError } from '../../domain/errors/CargaCodigoDuplicadoError.js';
import type { CargaQuimicaRepository } from '../../domain/repositories/CargaQuimicaRepository.js';
import type { ProdutoQuimicoRepository } from '../../domain/repositories/ProdutoQuimicoRepository.js';
import { assertCargaTransition, CargaTransitionError } from '../../domain/services/CargaStatusTransitions.js';
import { logger } from '../../shared/logger.js';

export interface CargaQuimicaInput {
  codigo: string;
  produtoQuimicoId: string;
  quantidade: string;
  unidadeMedida: string;
  origem: string;
  destino: string;
  responsavelTecnico: string;
  documentacaoObrigatoria: boolean;
  dataEntrada: Date;
}

export class CargaQuimicaService {
  constructor(
    private readonly cargas: CargaQuimicaRepository,
    private readonly produtos: ProdutoQuimicoRepository,
  ) {}

  async create(input: CargaQuimicaInput): Promise<CargaQuimicaDetalhada> {
    this.validate(input);
    const produto = await this.produtos.findById(input.produtoQuimicoId);
    if (!produto) throw new ApplicationError('Produto químico não encontrado', 404, 'PRODUTO_NAO_ENCONTRADO');
    if (produto.status !== ProdutoStatus.ATIVO) {
      throw new ApplicationError('Produto químico inativo', 409, 'PRODUTO_INATIVO');
    }
    if (await this.cargas.findByCodigo(input.codigo)) {
      throw new ApplicationError('Código de carga já cadastrado', 409, 'CODIGO_CARGA_DUPLICADO');
    }

    try {
      const carga = await this.cargas.create({
        ...input,
        codigo: input.codigo.trim(),
        unidadeMedida: input.unidadeMedida.trim(),
        origem: input.origem.trim(),
        destino: input.destino.trim(),
        responsavelTecnico: input.responsavelTecnico.trim(),
        status: CargaStatus.REGISTRADA,
      });
      logger.info('Carga química registrada', { cargaId: carga.id, codigo: carga.codigo });
      return carga;
    } catch (error) {
      if (error instanceof CargaCodigoDuplicadoError) {
        throw new ApplicationError(error.message, 409, 'CODIGO_CARGA_DUPLICADO');
      }
      throw error;
    }
  }

  list(): Promise<CargaQuimicaDetalhada[]> {
    return this.cargas.findAll();
  }

  async getById(id: string): Promise<CargaQuimicaDetalhada> {
    const carga = await this.cargas.findById(id);
    if (!carga) throw new ApplicationError('Carga química não encontrada', 404, 'CARGA_NAO_ENCONTRADA');
    return carga;
  }

  async changeStatus(id: string, payload: unknown): Promise<CargaQuimicaDetalhada> {
    const carga = await this.getById(id);
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      throw new ApplicationError('Status inválido', 400, 'STATUS_INVALIDO');
    }
    const body = payload as Record<string, unknown>;
    if (Object.keys(body).length !== 1 || !Object.hasOwn(body, 'status') ||
        typeof body.status !== 'string' || !Object.values(CargaStatus).includes(body.status as CargaStatus)) {
      throw new ApplicationError('Status inválido', 400, 'STATUS_INVALIDO');
    }
    return this.applyTransition(carga, body.status as CargaStatus);
  }

  private async transition(id: string, next: CargaStatus): Promise<CargaQuimicaDetalhada> {
    return this.applyTransition(await this.getById(id), next);
  }

  private async applyTransition(carga: CargaQuimicaDetalhada, next: CargaStatus): Promise<CargaQuimicaDetalhada> {
    try {
      assertCargaTransition(carga, next);
    } catch (error) {
      if (error instanceof CargaTransitionError) {
        throw new ApplicationError(error.message, 409,
          error.reason === 'MISSING_DOCUMENTATION' ? 'DOCUMENTACAO_AUSENTE' : 'TRANSICAO_STATUS_INVALIDA');
      }
      throw error;
    }
    const updated = await this.cargas.updateStatusIfCurrent(carga.id, carga.status, next);
    if (!updated) {
      if (!await this.cargas.findById(carga.id)) {
        throw new ApplicationError('Carga química não encontrada', 404, 'CARGA_NAO_ENCONTRADA');
      }
      throw new ApplicationError('Status da carga foi alterado por outra operação', 409, 'TRANSICAO_STATUS_INVALIDA');
    }
    const event = next === CargaStatus.BLOQUEADA ? 'Carga química bloqueada'
      : next === CargaStatus.LIBERADA ? 'Carga química liberada'
      : next === CargaStatus.CANCELADA ? 'Carga química cancelada'
      : 'Status da carga alterado';
    logger.info(event, { cargaId: updated.id, anterior: carga.status, atual: updated.status });
    return updated;
  }

  block(id: string): Promise<CargaQuimicaDetalhada> {
    return this.transition(id, CargaStatus.BLOQUEADA);
  }

  release(id: string): Promise<CargaQuimicaDetalhada> {
    return this.transition(id, CargaStatus.LIBERADA);
  }

  cancel(id: string): Promise<CargaQuimicaDetalhada> {
    return this.transition(id, CargaStatus.CANCELADA);
  }

  private validate(input: CargaQuimicaInput): void {
    for (const field of ['codigo', 'produtoQuimicoId', 'unidadeMedida', 'origem', 'destino', 'responsavelTecnico'] as const) {
      if (typeof input[field] !== 'string' || !input[field].trim()) {
        throw new ApplicationError(`${field} é obrigatório`, 400);
      }
    }
    const match = /^(\d{1,11})(?:\.(\d{1,3}))?$/.exec(input.quantidade);
    if (!match || BigInt(match[1]) * 1000n + BigInt((match[2] ?? '').padEnd(3, '0')) <= 0n) {
      throw new ApplicationError('Quantidade deve ser maior que zero e caber em Decimal(14,3)', 400);
    }
    if (typeof input.documentacaoObrigatoria !== 'boolean') {
      throw new ApplicationError('documentacaoObrigatoria deve ser booleano', 400);
    }
    if (!(input.dataEntrada instanceof Date) || Number.isNaN(input.dataEntrada.getTime())) {
      throw new ApplicationError('dataEntrada inválida', 400);
    }
  }
}
