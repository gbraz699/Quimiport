import { CargaStatus, type CargaQuimica, type CargaQuimicaDetalhada } from '../../domain/entities/CargaQuimica.js';
import { CargaCodigoDuplicadoError } from '../../domain/errors/CargaCodigoDuplicadoError.js';
import type { CargaQuimicaRepository } from '../../domain/repositories/CargaQuimicaRepository.js';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { toDomainProdutoQuimico } from './PrismaProdutoQuimicoRepository.js';

type PrismaCargaComProduto = Prisma.CargaQuimicaGetPayload<{ include: { produtoQuimico: true } }>;

function toDomain(carga: PrismaCargaComProduto): CargaQuimicaDetalhada {
  const produto = toDomainProdutoQuimico(carga.produtoQuimico);
  return {
    id: carga.id,
    codigo: carga.codigo,
    produtoQuimicoId: carga.produtoQuimicoId,
    quantidade: carga.quantidade.toString(),
    unidadeMedida: carga.unidadeMedida,
    origem: carga.origem,
    destino: carga.destino,
    responsavelTecnico: carga.responsavelTecnico,
    documentacaoObrigatoria: carga.documentacaoObrigatoria,
    status: CargaStatus[carga.status],
    dataEntrada: carga.dataEntrada,
    createdAt: carga.createdAt,
    updatedAt: carga.updatedAt,
    produtoQuimico: {
      id: produto.id,
      nome: produto.nome,
      numeroOnu: produto.numeroOnu,
      classeRisco: produto.classeRisco,
      status: produto.status,
    },
  };
}

export class PrismaCargaQuimicaRepository implements CargaQuimicaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: Omit<CargaQuimica, 'id' | 'createdAt' | 'updatedAt'>): Promise<CargaQuimicaDetalhada> {
    try {
      const carga = await this.prisma.cargaQuimica.create({
        data,
        include: { produtoQuimico: true },
      });
      return toDomain(carga);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new CargaCodigoDuplicadoError();
      }
      throw error;
    }
  }

  async findById(id: string): Promise<CargaQuimicaDetalhada | null> {
    const carga = await this.prisma.cargaQuimica.findUnique({
      where: { id },
      include: { produtoQuimico: true },
    });
    return carga ? toDomain(carga) : null;
  }

  async findByCodigo(codigo: string): Promise<CargaQuimicaDetalhada | null> {
    const carga = await this.prisma.cargaQuimica.findUnique({
      where: { codigo },
      include: { produtoQuimico: true },
    });
    return carga ? toDomain(carga) : null;
  }

  async findAll(): Promise<CargaQuimicaDetalhada[]> {
    const cargas = await this.prisma.cargaQuimica.findMany({
      include: { produtoQuimico: true },
      orderBy: { createdAt: 'desc' },
    });
    return cargas.map(toDomain);
  }

  async update(carga: CargaQuimica): Promise<CargaQuimicaDetalhada> {
    const updated = await this.prisma.cargaQuimica.update({
      where: { id: carga.id },
      data: {
        codigo: carga.codigo,
        produtoQuimicoId: carga.produtoQuimicoId,
        quantidade: carga.quantidade,
        unidadeMedida: carga.unidadeMedida,
        origem: carga.origem,
        destino: carga.destino,
        responsavelTecnico: carga.responsavelTecnico,
        documentacaoObrigatoria: carga.documentacaoObrigatoria,
        status: carga.status,
        dataEntrada: carga.dataEntrada,
      },
      include: { produtoQuimico: true },
    });
    return toDomain(updated);
  }

  async updateStatusIfCurrent(id: string, current: CargaStatus, next: CargaStatus): Promise<CargaQuimicaDetalhada | null> {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.cargaQuimica.updateMany({
        where: {
          id,
          status: current,
          ...(next === CargaStatus.LIBERADA ? { documentacaoObrigatoria: true } : {}),
        },
        data: { status: next },
      });
      if (result.count === 0) return null;
      const updated = await tx.cargaQuimica.findUniqueOrThrow({
        where: { id },
        include: { produtoQuimico: true },
      });
      return toDomain(updated);
    });
  }
}
