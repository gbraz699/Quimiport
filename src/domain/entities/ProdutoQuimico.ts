export enum ProdutoStatus {
  ATIVO = 'ATIVO',
  INATIVO = 'INATIVO',
}

export interface ProdutoQuimico {
  id: string;
  nome: string;
  descricao: string | null;
  numeroOnu: string | null;
  classeRisco: string;
  grupoCompatibilidade: string | null;
  status: ProdutoStatus;
  createdAt: Date;
  updatedAt: Date;
}
