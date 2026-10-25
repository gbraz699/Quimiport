import { CargaStatus, type CargaQuimica } from '../entities/CargaQuimica.js';

const allowedTransitions: Record<CargaStatus, readonly CargaStatus[]> = {
  [CargaStatus.REGISTRADA]: [CargaStatus.EM_ANALISE, CargaStatus.CANCELADA],
  [CargaStatus.EM_ANALISE]: [CargaStatus.EM_INSPECAO, CargaStatus.CANCELADA],
  [CargaStatus.EM_INSPECAO]: [CargaStatus.LIBERADA, CargaStatus.BLOQUEADA, CargaStatus.CANCELADA],
  [CargaStatus.LIBERADA]: [CargaStatus.EM_MOVIMENTACAO, CargaStatus.CANCELADA],
  [CargaStatus.BLOQUEADA]: [CargaStatus.CANCELADA],
  [CargaStatus.EM_MOVIMENTACAO]: [CargaStatus.FINALIZADA],
  [CargaStatus.FINALIZADA]: [],
  [CargaStatus.CANCELADA]: [],
};

export class CargaTransitionError extends Error {
  constructor(message: string, readonly reason: 'INVALID_TRANSITION' | 'MISSING_DOCUMENTATION') {
    super(message);
    this.name = 'CargaTransitionError';
  }
}

export function canTransition(current: CargaStatus, next: CargaStatus): boolean {
  return allowedTransitions[current].includes(next);
}

export function assertCargaTransition(carga: CargaQuimica, next: CargaStatus): void {
  if (!canTransition(carga.status, next)) {
    throw new CargaTransitionError(`Transição de ${carga.status} para ${next} não permitida`, 'INVALID_TRANSITION');
  }
  if (carga.status === CargaStatus.EM_INSPECAO && next === CargaStatus.LIBERADA && !carga.documentacaoObrigatoria) {
    throw new CargaTransitionError('Documentação obrigatória ausente para liberação', 'MISSING_DOCUMENTATION');
  }
}
