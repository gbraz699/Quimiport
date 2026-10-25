import { ApplicationError } from '../../application/errors/ApplicationError.js';
import type { CargaQuimicaInput } from '../../application/cargas-quimicas/CargaQuimicaService.js';
import { parseProdutoId } from './produtoQuimicoInput.js';

const allowedFields = new Set([
  'codigo', 'produtoQuimicoId', 'quantidade', 'unidadeMedida', 'origem', 'destino',
  'responsavelTecnico', 'documentacaoObrigatoria', 'dataEntrada',
]);

export function parseCargaQuimicaInput(value: unknown): CargaQuimicaInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ApplicationError('Corpo da requisição inválido', 400);
  }
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((field) => !allowedFields.has(field))) {
    throw new ApplicationError('Campo não permitido', 400);
  }

  const required = (field: 'codigo' | 'produtoQuimicoId' | 'unidadeMedida' | 'origem' | 'destino' | 'responsavelTecnico'): string => {
    const entry = body[field];
    if (typeof entry !== 'string' || !entry.trim()) {
      throw new ApplicationError(`${field} é obrigatório`, 400);
    }
    return entry.trim();
  };

  const quantity = body.quantidade;
  if ((typeof quantity !== 'string' && typeof quantity !== 'number') ||
      (typeof quantity === 'number' && !Number.isFinite(quantity))) {
    throw new ApplicationError('quantidade inválida', 400);
  }

  const documentation = body.documentacaoObrigatoria;
  if (documentation !== undefined && typeof documentation !== 'boolean') {
    throw new ApplicationError('documentacaoObrigatoria deve ser booleano', 400);
  }

  const dateValue = body.dataEntrada;
  if (dateValue !== undefined && typeof dateValue !== 'string') {
    throw new ApplicationError('dataEntrada deve ser texto', 400);
  }
  const dataEntrada = dateValue === undefined ? new Date() : new Date(dateValue);
  if (Number.isNaN(dataEntrada.getTime())) {
    throw new ApplicationError('dataEntrada inválida', 400);
  }

  return {
    codigo: required('codigo'),
    produtoQuimicoId: parseProdutoId(required('produtoQuimicoId')),
    quantidade: String(quantity),
    unidadeMedida: required('unidadeMedida'),
    origem: required('origem'),
    destino: required('destino'),
    responsavelTecnico: required('responsavelTecnico'),
    documentacaoObrigatoria: documentation ?? false,
    dataEntrada,
  };
}

