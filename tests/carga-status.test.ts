import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { createIsolatedPostgresApp } from './support/isolatedPostgresApp.js';
import { CargaStatus } from '../src/domain/entities/CargaQuimica.js';
import { canTransition } from '../src/domain/services/CargaStatusTransitions.js';

const testApp = createIsolatedPostgresApp('status');
const prisma = testApp.prisma;
let baseUrl: string;

before(async () => {
  baseUrl = await testApp.start();
});

after(async () => testApp.stop());

async function request(method: string, path: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const responseBody = response.headers.get('content-type')?.includes('application/json')
    ? await response.json()
    : await response.text();
  return { status: response.status, body: responseBody as any };
}

async function createCarga(documentacaoObrigatoria = true) {
  const produto = await request('POST', '/produtos-quimicos', {
    nome: `Produto ${randomUUID()}`,
    classeRisco: '3',
  });
  assert.equal(produto.status, 201);
  const carga = await request('POST', '/cargas-quimicas', {
    codigo: `CARGA-${randomUUID()}`,
    produtoQuimicoId: produto.body.id,
    quantidade: '1.125',
    unidadeMedida: 'kg',
    origem: 'Santos',
    destino: 'Campinas',
    responsavelTecnico: 'Maria Silva',
    documentacaoObrigatoria,
  });
  assert.equal(carga.status, 201);
  return carga.body as { id: string; status: string; quantidade: string; produtoQuimico: { id: string } };
}

async function changeStatus(id: string, status: string) {
  return request('PATCH', `/cargas-quimicas/${id}/status`, { status });
}

async function advance(id: string, statuses: string[]) {
  for (const status of statuses) {
    const response = await changeStatus(id, status);
    assert.equal(response.status, 200, `${status}: ${JSON.stringify(response.body)}`);
  }
}

const paths: Record<string, string[]> = {
  REGISTRADA: [],
  EM_ANALISE: ['EM_ANALISE'],
  EM_INSPECAO: ['EM_ANALISE', 'EM_INSPECAO'],
  LIBERADA: ['EM_ANALISE', 'EM_INSPECAO', 'LIBERADA'],
  BLOQUEADA: ['EM_ANALISE', 'EM_INSPECAO', 'BLOQUEADA'],
  EM_MOVIMENTACAO: ['EM_ANALISE', 'EM_INSPECAO', 'LIBERADA', 'EM_MOVIMENTACAO'],
  FINALIZADA: ['EM_ANALISE', 'EM_INSPECAO', 'LIBERADA', 'EM_MOVIMENTACAO', 'FINALIZADA'],
  CANCELADA: ['CANCELADA'],
};

test('matriz permite somente as onze transições especificadas', () => {
  const allowed = new Set([
    'REGISTRADA:EM_ANALISE', 'REGISTRADA:CANCELADA',
    'EM_ANALISE:EM_INSPECAO', 'EM_ANALISE:CANCELADA',
    'EM_INSPECAO:LIBERADA', 'EM_INSPECAO:BLOQUEADA', 'EM_INSPECAO:CANCELADA',
    'LIBERADA:EM_MOVIMENTACAO', 'LIBERADA:CANCELADA',
    'BLOQUEADA:CANCELADA',
    'EM_MOVIMENTACAO:FINALIZADA',
  ]);
  for (const current of Object.values(CargaStatus)) {
    for (const next of Object.values(CargaStatus)) {
      assert.equal(canTransition(current, next), allowed.has(`${current}:${next}`), `${current} → ${next}`);
    }
  }
});

for (const [current, next] of [
  ['REGISTRADA', 'EM_ANALISE'],
  ['EM_ANALISE', 'EM_INSPECAO'],
  ['EM_INSPECAO', 'LIBERADA'],
  ['LIBERADA', 'EM_MOVIMENTACAO'],
  ['EM_MOVIMENTACAO', 'FINALIZADA'],
] as const) {
  test(`fluxo principal ${current} → ${next}`, async () => {
    const carga = await createCarga();
    await advance(carga.id, paths[current]);
    const response = await changeStatus(carga.id, next);
    assert.equal(response.status, 200);
    assert.equal(response.body.status, next);
    assert.equal(response.body.quantidade, '1.125');
    assert.equal(response.body.produtoQuimico.id, carga.produtoQuimico.id);
  });
}

for (const current of ['REGISTRADA', 'EM_ANALISE', 'EM_INSPECAO', 'LIBERADA', 'BLOQUEADA']) {
  test(`permite cancelamento a partir de ${current}`, async () => {
    const carga = await createCarga();
    await advance(carga.id, paths[current]);
    const response = await request('PATCH', `/cargas-quimicas/${carga.id}/cancelar`);
    assert.equal(response.status, 200);
    assert.equal(response.body.status, 'CANCELADA');
  });
}

test('bloqueia carga em inspeção', async () => {
  const carga = await createCarga();
  await advance(carga.id, paths.EM_INSPECAO);
  const response = await request('PATCH', `/cargas-quimicas/${carga.id}/bloquear`);
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'BLOQUEADA');
});

test('não bloqueia carga já bloqueada novamente', async () => {
  const carga = await createCarga();
  await advance(carga.id, paths.BLOQUEADA);
  assert.equal((await request('PATCH', `/cargas-quimicas/${carga.id}/bloquear`)).status, 409);
});

test('libera carga em inspeção com documentação', async () => {
  const carga = await createCarga(true);
  await advance(carga.id, paths.EM_INSPECAO);
  const response = await request('PATCH', `/cargas-quimicas/${carga.id}/liberar`);
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'LIBERADA');
});

test('rejeita liberação sem documentação pelo endpoint dedicado e genérico', async () => {
  const carga = await createCarga(false);
  await advance(carga.id, paths.EM_INSPECAO);
  assert.equal((await request('PATCH', `/cargas-quimicas/${carga.id}/liberar`)).status, 409);
  assert.equal((await changeStatus(carga.id, 'LIBERADA')).status, 409);
  assert.equal((await request('GET', `/cargas-quimicas/${carga.id}`)).body.status, 'EM_INSPECAO');
});

test('não libera carga fora de EM_INSPECAO', async () => {
  const carga = await createCarga();
  assert.equal((await request('PATCH', `/cargas-quimicas/${carga.id}/liberar`)).status, 409);
});

for (const [current, next] of [
  ['CANCELADA', 'LIBERADA'],
  ['FINALIZADA', 'EM_MOVIMENTACAO'],
  ['BLOQUEADA', 'EM_MOVIMENTACAO'],
  ['REGISTRADA', 'FINALIZADA'],
  ['EM_INSPECAO', 'FINALIZADA'],
  ['LIBERADA', 'REGISTRADA'],
  ['BLOQUEADA', 'EM_ANALISE'],
] as const) {
  test(`rejeita transição ${current} → ${next}`, async () => {
    const carga = await createCarga();
    await advance(carga.id, paths[current]);
    assert.equal((await changeStatus(carga.id, next)).status, 409);
    assert.equal((await request('GET', `/cargas-quimicas/${carga.id}`)).body.status, current);
  });
}

test('CANCELADA é terminal mesmo para repetir cancelamento', async () => {
  const carga = await createCarga();
  await advance(carga.id, paths.CANCELADA);
  assert.equal((await request('PATCH', `/cargas-quimicas/${carga.id}/cancelar`)).status, 409);
});

test('FINALIZADA é terminal para qualquer nova alteração', async () => {
  const carga = await createCarga();
  await advance(carga.id, paths.FINALIZADA);
  assert.equal((await request('PATCH', `/cargas-quimicas/${carga.id}/cancelar`)).status, 409);
});

test('retorna 400 para status inexistente', async () => {
  const carga = await createCarga();
  assert.equal((await changeStatus(carga.id, 'DESCONHECIDA')).status, 400);
});

test('retorna 400 para formato de status inválido', async () => {
  const carga = await createCarga();
  assert.equal((await request('PATCH', `/cargas-quimicas/${carga.id}/status`, { status: 42 })).status, 400);
});

test('retorna 404 para carga inexistente', async () => {
  assert.equal((await changeStatus(randomUUID(), 'EM_ANALISE')).status, 404);
});

test('retorna 404 para carga inexistente mesmo com status inválido', async () => {
  assert.equal((await changeStatus(randomUUID(), 'DESCONHECIDA')).status, 404);
});

test('duas transições concorrentes a partir de EM_INSPECAO não sobrescrevem uma à outra', async () => {
  const carga = await createCarga();
  await advance(carga.id, paths.EM_INSPECAO);
  const responses = await Promise.all([
    changeStatus(carga.id, 'LIBERADA'),
    changeStatus(carga.id, 'BLOQUEADA'),
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  const persisted = await prisma.cargaQuimica.findUnique({ where: { id: carga.id } });
  assert.equal(persisted?.status, responses.find((response) => response.status === 200)?.body.status);
});

test('endpoint /bloquear valida origem EM_INSPECAO', async () => {
  const carga = await createCarga();
  assert.equal((await request('PATCH', `/cargas-quimicas/${carga.id}/bloquear`)).status, 409);
});

test('endpoint /liberar valida origem EM_INSPECAO', async () => {
  const carga = await createCarga();
  assert.equal((await request('PATCH', `/cargas-quimicas/${carga.id}/liberar`)).status, 409);
});

test('endpoint /cancelar não aceita EM_MOVIMENTACAO', async () => {
  const carga = await createCarga();
  await advance(carga.id, paths.EM_MOVIMENTACAO);
  assert.equal((await request('PATCH', `/cargas-quimicas/${carga.id}/cancelar`)).status, 409);
});

test('endpoints especializados e /status rejeitam as mesmas origens inválidas', async () => {
  for (const scenario of [
    { current: 'REGISTRADA', next: 'BLOQUEADA', action: 'bloquear' },
    { current: 'REGISTRADA', next: 'LIBERADA', action: 'liberar' },
    { current: 'EM_MOVIMENTACAO', next: 'CANCELADA', action: 'cancelar' },
  ]) {
    const carga = await createCarga();
    await advance(carga.id, paths[scenario.current]);
    const generic = await changeStatus(carga.id, scenario.next);
    const specialized = await request('PATCH', `/cargas-quimicas/${carga.id}/${scenario.action}`);
    assert.equal(generic.status, 409);
    assert.equal(specialized.status, 409);
    assert.equal(generic.body.error.code, specialized.body.error.code);
    assert.equal((await request('GET', `/cargas-quimicas/${carga.id}`)).body.status, scenario.current);
  }
});

test('endpoint /status persiste a nova situação no banco', async () => {
  const carga = await createCarga();
  assert.equal((await changeStatus(carga.id, 'EM_ANALISE')).status, 200);
  const persisted = await prisma.cargaQuimica.findUnique({ where: { id: carga.id } });
  assert.equal(persisted?.status, 'EM_ANALISE');
});
