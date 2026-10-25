import { ApplicationError } from '../../application/errors/ApplicationError.js';
import type { ProdutoQuimicoInput } from '../../application/produtos-quimicos/ProdutoQuimicoService.js';
import { ProdutoStatus } from '../../domain/entities/ProdutoQuimico.js';

const allowedFields = new Set([
  'nome', 'descricao', 'numeroOnu', 'classeRisco', 'grupoCompatibilidade', 'status',
]);

export function parseProdutoQuimicoInput(value: unknown): ProdutoQuimicoInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ApplicationError('Corpo da requisição inválido', 400);
  }
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !allowedFields.has(key))) {
    throw new ApplicationError('Campo não permitido', 400);
  }

  const required = (field: 'nome' | 'classeRisco'): string => {
    const entry = body[field];
    if (typeof entry !== 'string' || !entry.trim()) {
      throw new ApplicationError(`${field} é obrigatório`, 400);
    }
    return entry.trim();
  };
  const optional = (field: 'descricao' | 'numeroOnu' | 'grupoCompatibilidade'): string | null => {
    const entry = body[field];
    if (entry === undefined || entry === null) return null;
    if (typeof entry !== 'string') throw new ApplicationError(`${field} deve ser texto`, 400);
    return entry;
  };

  const status = body.status;
  if (status !== undefined && status !== ProdutoStatus.ATIVO && status !== ProdutoStatus.INATIVO) {
    throw new ApplicationError('Status inválido', 400, 'STATUS_INVALIDO');
  }

  return {
    nome: required('nome'),
    descricao: optional('descricao'),
    numeroOnu: optional('numeroOnu'),
    classeRisco: required('classeRisco'),
    grupoCompatibilidade: optional('grupoCompatibilidade'),
    status,
  };
}

export function parseProdutoId(value: string | string[] | undefined): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new ApplicationError('ID inválido', 400);
  }
  return value;
}
