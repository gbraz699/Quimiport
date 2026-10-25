import type { ProdutoQuimico } from '../entities/ProdutoQuimico.js';

export interface ProdutoQuimicoRepository {
  create(data: Omit<ProdutoQuimico, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProdutoQuimico>;
  findById(id: string): Promise<ProdutoQuimico | null>;
  findAll(): Promise<ProdutoQuimico[]>;
  update(produto: ProdutoQuimico): Promise<ProdutoQuimico>;
}
