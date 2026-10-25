import { ProdutoStatus, type ProdutoQuimico } from '../../domain/entities/ProdutoQuimico.js';
import type { ProdutoQuimicoRepository } from '../../domain/repositories/ProdutoQuimicoRepository.js';
import type { PrismaClient, ProdutoQuimico as PrismaProdutoQuimico } from '../../generated/prisma/client.js';

export function toDomainProdutoQuimico(produto: PrismaProdutoQuimico): ProdutoQuimico {
  return {
    id: produto.id,
    nome: produto.nome,
    descricao: produto.descricao,
    numeroOnu: produto.numeroOnu,
    classeRisco: produto.classeRisco,
    grupoCompatibilidade: produto.grupoCompatibilidade,
    status: produto.status === 'ATIVO' ? ProdutoStatus.ATIVO : ProdutoStatus.INATIVO,
    createdAt: produto.createdAt,
    updatedAt: produto.updatedAt,
  };
}

export class PrismaProdutoQuimicoRepository implements ProdutoQuimicoRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: Omit<ProdutoQuimico, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProdutoQuimico> {
    const produto = await this.prisma.produtoQuimico.create({ data });
    return toDomainProdutoQuimico(produto);
  }

  async findById(id: string): Promise<ProdutoQuimico | null> {
    const produto = await this.prisma.produtoQuimico.findUnique({ where: { id } });
    return produto ? toDomainProdutoQuimico(produto) : null;
  }

  async findAll(): Promise<ProdutoQuimico[]> {
    const produtos = await this.prisma.produtoQuimico.findMany({ orderBy: { createdAt: 'desc' } });
    return produtos.map(toDomainProdutoQuimico);
  }

  async update(produto: ProdutoQuimico): Promise<ProdutoQuimico> {
    const updated = await this.prisma.produtoQuimico.update({
      where: { id: produto.id },
      data: {
        nome: produto.nome,
        descricao: produto.descricao,
        numeroOnu: produto.numeroOnu,
        classeRisco: produto.classeRisco,
        grupoCompatibilidade: produto.grupoCompatibilidade,
        status: produto.status,
      },
    });
    return toDomainProdutoQuimico(updated);
  }
}
