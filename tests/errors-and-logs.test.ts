import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import type { ProdutoQuimicoRepository } from '../src/domain/repositories/ProdutoQuimicoRepository.js';
import type { CargaQuimicaRepository } from '../src/domain/repositories/CargaQuimicaRepository.js';
import { createIsolatedPostgresApp } from './support/isolatedPostgresApp.js';
import express from 'express';
import { createRequestLogger } from '../src/interfaces/middleware/requestLogger.js';
import { createLogger, logger } from '../src/shared/logger.js';

const testApp = createIsolatedPostgresApp('errors');
const produtos = testApp.produtos;
const cargas = testApp.cargas;
let baseUrl: string;

before(async () => {
  baseUrl = await testApp.start();
});

after(async () => testApp.stop());

async function request(method: string, path: string, body?: unknown, url = baseUrl) {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

function expectError(body: unknown, code: string) {
  assert.deepEqual(Object.keys(body as object), ['error']);
  const error = (body as { error: { code: string; message: string } }).error;
  assert.equal(error.code, code);
  assert.equal(typeof error.message, 'string');
  assert(error.message.length > 0);
  assert.doesNotMatch(JSON.stringify(body), /stack|node_modules|prisma\/runtime|SELECT .* FROM/i);
}

async function createProduto() {
  const response = await request('POST', '/produtos-quimicos', {
    nome: `Produto ${randomUUID()}`,
    classeRisco: '3',
  });
  assert.equal(response.status, 201);
  return response.body as { id: string };
}

async function createCarga(produtoQuimicoId: string, overrides: Record<string, unknown> = {}) {
  const response = await request('POST', '/cargas-quimicas', {
    codigo: `CARGA-${randomUUID()}`,
    produtoQuimicoId,
    quantidade: '1.5',
    unidadeMedida: 'kg',
    origem: 'Santos',
    destino: 'Campinas',
    responsavelTecnico: 'Maria Silva',
    documentacaoObrigatoria: true,
    ...overrides,
  });
  assert.equal(response.status, 201);
  return response.body as { id: string; codigo: string };
}

async function advance(id: string, statuses: string[]) {
  for (const status of statuses) {
    assert.equal((await request('PATCH', `/cargas-quimicas/${id}/status`, { status })).status, 200);
  }
}

test('400 de validação usa formato padronizado', async () => {
  const response = await request('POST', '/produtos-quimicos', { classeRisco: '3' });
  assert.equal(response.status, 400);
  expectError(response.body, 'INVALID_INPUT');
});

test('JSON malformado usa o mesmo envelope de erro', async () => {
  const response = await fetch(`${baseUrl}/produtos-quimicos`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{invalid',
  });
  assert.equal(response.status, 400);
  expectError(await response.json(), 'INVALID_JSON');
});

test('400 de status inválido usa código próprio', async () => {
  const produto = await createProduto();
  const carga = await createCarga(produto.id);
  const response = await request('PATCH', `/cargas-quimicas/${carga.id}/status`, { status: 'DESCONHECIDA' });
  assert.equal(response.status, 400);
  expectError(response.body, 'STATUS_INVALIDO');
});

test('404 de produto inexistente mantém código e formato', async () => {
  const response = await request('GET', `/produtos-quimicos/${randomUUID()}`);
  assert.equal(response.status, 404);
  expectError(response.body, 'PRODUTO_NAO_ENCONTRADO');
});

test('404 de carga inexistente mantém código e formato', async () => {
  const response = await request('GET', `/cargas-quimicas/${randomUUID()}`);
  assert.equal(response.status, 404);
  expectError(response.body, 'CARGA_NAO_ENCONTRADA');
});

test('rota inexistente retorna 404 no mesmo formato', async () => {
  const response = await request('GET', '/rota-inexistente');
  assert.equal(response.status, 404);
  expectError(response.body, 'ROTA_NAO_ENCONTRADA');
});

test('409 de produto inativo mantém código e formato', async () => {
  const produto = await createProduto();
  assert.equal((await request('PATCH', `/produtos-quimicos/${produto.id}/inativar`)).status, 200);
  const response = await request('POST', '/cargas-quimicas', {
    codigo: `CARGA-${randomUUID()}`, produtoQuimicoId: produto.id, quantidade: 1,
    unidadeMedida: 'kg', origem: 'Santos', destino: 'Campinas', responsavelTecnico: 'Maria',
  });
  assert.equal(response.status, 409);
  expectError(response.body, 'PRODUTO_INATIVO');
});

test('409 de código duplicado mantém código e formato', async () => {
  const produto = await createProduto();
  const carga = await createCarga(produto.id);
  const response = await request('POST', '/cargas-quimicas', {
    codigo: carga.codigo, produtoQuimicoId: produto.id, quantidade: 1,
    unidadeMedida: 'kg', origem: 'Santos', destino: 'Campinas', responsavelTecnico: 'Maria',
  });
  assert.equal(response.status, 409);
  expectError(response.body, 'CODIGO_CARGA_DUPLICADO');
});

test('409 de transição inválida mantém código e formato', async () => {
  const produto = await createProduto();
  const carga = await createCarga(produto.id);
  const response = await request('PATCH', `/cargas-quimicas/${carga.id}/status`, { status: 'FINALIZADA' });
  assert.equal(response.status, 409);
  expectError(response.body, 'TRANSICAO_STATUS_INVALIDA');
});

test('409 de liberação sem documentação mantém código e formato', async () => {
  const produto = await createProduto();
  const carga = await createCarga(produto.id, { documentacaoObrigatoria: false });
  await advance(carga.id, ['EM_ANALISE', 'EM_INSPECAO']);
  const response = await request('PATCH', `/cargas-quimicas/${carga.id}/liberar`);
  assert.equal(response.status, 409);
  expectError(response.body, 'DOCUMENTACAO_AUSENTE');
});

test('erro inesperado retorna 500 genérico sem stack nem segredo', async () => {
  const failing = Object.create(produtos) as ProdutoQuimicoRepository;
  failing.findAll = async () => { throw new Error('DATABASE_PASSWORD=segredo query SELECT * FROM private_table'); };
  const temporary = createServer(createApp(failing, cargas));
  await new Promise<void>((resolveListen) => temporary.listen(0, '127.0.0.1', resolveListen));
  const address = temporary.address();
  assert(address && typeof address !== 'string');
  try {
    const response = await request('GET', '/produtos-quimicos', undefined, `http://127.0.0.1:${address.port}`);
    assert.equal(response.status, 500);
    expectError(response.body, 'INTERNAL_ERROR');
    assert.equal(response.body.error.message, 'Erro interno do servidor.');
    assert.doesNotMatch(JSON.stringify(response.body), /segredo|private_table|DATABASE_PASSWORD/);
  } finally {
    await new Promise<void>((resolveClose) => temporary.close(() => resolveClose()));
  }
});

test('erro P2002 do Prisma fica oculto mesmo quando consulta prévia perde uma disputa', async () => {
  const produto = await createProduto();
  const carga = await createCarga(produto.id);
  const racing = Object.create(cargas) as CargaQuimicaRepository;
  racing.findByCodigo = async () => null;
  const temporary = createServer(createApp(produtos, racing));
  await new Promise<void>((resolveListen) => temporary.listen(0, '127.0.0.1', resolveListen));
  const address = temporary.address();
  assert(address && typeof address !== 'string');
  try {
    const response = await request('POST', '/cargas-quimicas', {
      codigo: carga.codigo, produtoQuimicoId: produto.id, quantidade: 1,
      unidadeMedida: 'kg', origem: 'Santos', destino: 'Campinas', responsavelTecnico: 'Maria',
    }, `http://127.0.0.1:${address.port}`);
    assert.equal(response.status, 409);
    expectError(response.body, 'CODIGO_CARGA_DUPLICADO');
    assert.doesNotMatch(JSON.stringify(response.body), /P2002|Prisma/i);
  } finally {
    await new Promise<void>((resolveClose) => temporary.close(() => resolveClose()));
  }
});

test('health continua funcionando', async () => {
  const response = await request('GET', '/health');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok' });
});

test('logger oferece níveis e pode ser silenciado nos testes', () => {
  const lines: string[] = [];
  const sink = {
    info: (line: string) => lines.push(`info:${line}`),
    warn: (line: string) => lines.push(`warn:${line}`),
    error: (line: string) => lines.push(`error:${line}`),
  } as unknown as Pick<Console, 'info' | 'warn' | 'error'>;
  const active = createLogger(sink, () => false);
  active.info('Operação', { id: '123' });
  active.warn('Validação', { code: 'INVALID_INPUT' });
  active.error('Falha', { errorName: 'Error' });
  assert.equal(lines.length, 3);
  assert.match(lines[0], /info:.*INFO Operação.*123/);
  assert.match(lines[1], /warn:.*WARN Validação.*INVALID_INPUT/);
  assert.match(lines[2], /error:.*ERROR Falha.*Error/);
  const silent = createLogger(sink, () => true);
  silent.info('Silencioso');
  silent.warn('Silencioso');
  silent.error('Silencioso');
  assert.equal(lines.length, 3);
  assert.doesNotThrow(() => logger.info('Teste de operação'));
  assert.doesNotThrow(() => logger.warn('Teste de validação'));
});

test('middleware HTTP registra método, caminho, status e duração sem query', async () => {
  const entries: Array<{ event: string; details: Record<string, unknown> }> = [];
  const app = express();
  app.use(createRequestLogger({ info: (event, details) => entries.push({ event, details: details ?? {} }) }));
  app.get('/ping', (_request, response) => response.status(200).json({ ok: true }));
  const temporary = createServer(app);
  await new Promise<void>((resolveListen) => temporary.listen(0, '127.0.0.1', resolveListen));
  const address = temporary.address();
  assert(address && typeof address !== 'string');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/ping?token=segredo`);
    assert.equal(response.status, 200);
    await response.text();
    assert.equal(entries.length, 1);
    assert.equal(entries[0].event, 'HTTP');
    assert.equal(entries[0].details.method, 'GET');
    assert.equal(entries[0].details.path, '/ping');
    assert.equal(entries[0].details.status, 200);
    assert.equal(typeof entries[0].details.durationMs, 'number');
    assert.doesNotMatch(JSON.stringify(entries), /segredo/);
  } finally {
    await new Promise<void>((resolveClose) => temporary.close(() => resolveClose()));
  }
});
