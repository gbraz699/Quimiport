export enum CargaStatus {
  REGISTRADA = 'REGISTRADA',
  EM_ANALISE = 'EM_ANALISE',
  EM_INSPECAO = 'EM_INSPECAO',
  LIBERADA = 'LIBERADA',
  BLOQUEADA = 'BLOQUEADA',
  EM_MOVIMENTACAO = 'EM_MOVIMENTACAO',
  FINALIZADA = 'FINALIZADA',
  CANCELADA = 'CANCELADA',
}

import type { ProdutoQuimico } from './ProdutoQuimico.js';

export interface CargaQuimica {
  id: string;
  codigo: string;
  produtoQuimicoId: string;
  quantidade: string;
  unidadeMedida: string;
  origem: string;
  destino: string;
  responsavelTecnico: string;
  documentacaoObrigatoria: boolean;
  status: CargaStatus;
  dataEntrada: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CargaQuimicaDetalhada extends CargaQuimica {
  produtoQuimico: Pick<ProdutoQuimico, 'id' | 'nome' | 'numeroOnu' | 'classeRisco' | 'status'>;
}
