import type { CargaQuimica, CargaQuimicaDetalhada, CargaStatus } from '../entities/CargaQuimica.js';

export interface CargaQuimicaRepository {
  create(data: Omit<CargaQuimica, 'id' | 'createdAt' | 'updatedAt'>): Promise<CargaQuimicaDetalhada>;
  findById(id: string): Promise<CargaQuimicaDetalhada | null>;
  findByCodigo(codigo: string): Promise<CargaQuimicaDetalhada | null>;
  findAll(): Promise<CargaQuimicaDetalhada[]>;
  update(carga: CargaQuimica): Promise<CargaQuimicaDetalhada>;
  updateStatusIfCurrent(id: string, current: CargaStatus, next: CargaStatus): Promise<CargaQuimicaDetalhada | null>;
}
