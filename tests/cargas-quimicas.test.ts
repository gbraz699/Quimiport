import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { createIsolatedPostgresApp } from './support/isolatedPostgresApp.js';

const testApp = createIsolatedPostgresApp('cargas');
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
  return { status: response.status, body: await response.json() };
}

async function createProduto() {
  const response = await request('POST', '/produtos-quimicos', {
    nome: `Produto ${randomUUID()}`,
    classeRisco: '3',
    numeroOnu: '1090',
  });
  assert.equal(response.status, 201);
  return response.body as { id: string; nome: string };
}

function cargaInput(produtoQuimicoId: string, overrides: Record<string, unknown> = {}) {
  return {
    codigo: `CARGA-${randomUUID()}`,
    produtoQuimicoId,
    quantidade: '12.345',
    unidadeMedida: 'kg',
    origem: 'Santos',
    destino: 'Campinas',
    responsavelTecnico: 'Maria Silva',
    documentacaoObrigatoria: true,
    ...overrides,
  };
}

async function createCarga(produtoQuimicoId: string, overrides: Record<string, unknown> = {}) {
  const response = await request('POST', '/cargas-quimicas', cargaInput(produtoQuimicoId, overrides));
  assert.equal(response.status, 201);
  return response.body as { id: string; codigo: string; quantidade: string; status: string; produtoQuimico: { id: string; nome: string } };
}

test('registra carga química válida', async () => {
  const produto = await createProduto();
  const carga = await createCarga(produto.id);
  assert.match(carga.id, /^[0-9a-f-]{36}$/i);
  assert.equal(carga.quantidade, '12.345');
});

test('rejeita registro sem produto químico', async () => {
  const response = await request('POST', '/cargas-quimicas', cargaInput(randomUUID(), { produtoQuimicoId: undefined }));
  assert.equal(response.status, 400);
});

test('retorna 404 para produto associado inexistente', async () => {
  const response = await request('POST', '/cargas-quimicas', cargaInput(randomUUID()));
  assert.equal(response.status, 404);
});

test('retorna 409 para produto associado inativo', async () => {
  const produto = await createProduto();
  assert.equal((await request('PATCH', `/produtos-quimicos/${produto.id}/inativar`)).status, 200);
  const response = await request('POST', '/cargas-quimicas', cargaInput(produto.id));
  assert.equal(response.status, 409);
});

test('rejeita quantidade zero', async () => {
  const produto = await createProduto();
  assert.equal((await request('POST', '/cargas-quimicas', cargaInput(produto.id, { quantidade: 0 }))).status, 400);
});

test('rejeita quantidade negativa', async () => {
  const produto = await createProduto();
  assert.equal((await request('POST', '/cargas-quimicas', cargaInput(produto.id, { quantidade: -1 }))).status, 400);
});

test('rejeita registro sem responsável técnico', async () => {
  const produto = await createProduto();
  assert.equal((await request('POST', '/cargas-quimicas', cargaInput(produto.id, { responsavelTecnico: '' }))).status, 400);
});

test('retorna 409 para código de carga duplicado sem expor erro Prisma', async () => {
  const produto = await createProduto();
  const input = cargaInput(produto.id);
  assert.equal((await request('POST', '/cargas-quimicas', input)).status, 201);
  const duplicate = await request('POST', '/cargas-quimicas', input);
  assert.equal(duplicate.status, 409);
  assert.doesNotMatch(JSON.stringify(duplicate.body), /P2002|Prisma/i);
});

test('força status inicial REGISTRADA e rejeita status enviado', async () => {
  const produto = await createProduto();
  const carga = await createCarga(produto.id);
  assert.equal(carga.status, 'REGISTRADA');
  assert.equal((await request('POST', '/cargas-quimicas', cargaInput(produto.id, { status: 'LIBERADA' }))).status, 400);
});

test('permite documentação obrigatória igual a false', async () => {
  const produto = await createProduto();
  const carga = await createCarga(produto.id, { documentacaoObrigatoria: false });
  const persisted = await prisma.cargaQuimica.findUnique({ where: { id: carga.id } });
  assert(persisted);
  assert.equal(persisted.documentacaoObrigatoria, false);
});

test('lista cargas químicas', async () => {
  const produto = await createProduto();
  const carga = await createCarga(produto.id);
  const response = await request('GET', '/cargas-quimicas');
  assert.equal(response.status, 200);
  assert(Array.isArray(response.body));
  assert(response.body.some((item: { id: string }) => item.id === carga.id));
});

test('busca carga existente por id', async () => {
  const produto = await createProduto();
  const carga = await createCarga(produto.id);
  const response = await request('GET', `/cargas-quimicas/${carga.id}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.id, carga.id);
});

test('retorna 404 para carga inexistente', async () => {
  const response = await request('GET', `/cargas-quimicas/${randomUUID()}`);
  assert.equal(response.status, 404);
});

test('inclui produto associado nas respostas', async () => {
  const produto = await createProduto();
  const carga = await createCarga(produto.id);
  const response = await request('GET', `/cargas-quimicas/${carga.id}`);
  assert.equal(response.body.produtoQuimico.id, produto.id);
  assert.equal(response.body.produtoQuimico.nome, produto.nome);
  assert.equal(response.body.produtoQuimico.numeroOnu, '1090');
});

test('preserva quantidade decimal exata e valida data de entrada', async () => {
  const produto = await createProduto();
  const carga = await createCarga(produto.id, { quantidade: '0.001', dataEntrada: '2026-10-25T01:00:00.000Z' });
  assert.equal(carga.quantidade, '0.001');
  assert.equal((await request('POST', '/cargas-quimicas', cargaInput(produto.id, { dataEntrada: 'data inválida' }))).status, 400);
});
