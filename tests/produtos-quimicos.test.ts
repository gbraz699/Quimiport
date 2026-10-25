import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { createIsolatedPostgresApp } from './support/isolatedPostgresApp.js';

const testApp = createIsolatedPostgresApp('produtos');
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

async function createProduto(overrides: Record<string, unknown> = {}) {
  const response = await request('POST', '/produtos-quimicos', {
    nome: `Produto ${randomUUID()}`,
    classeRisco: '3',
    ...overrides,
  });
  assert.equal(response.status, 201);
  return response.body as { id: string; nome: string; classeRisco: string; status: string; updatedAt: string };
}

test('cadastra produto químico válido inicialmente ativo', async () => {
  const response = await request('POST', '/produtos-quimicos', {
    nome: 'Acetona',
    descricao: 'Solvente',
    numeroOnu: '1090',
    classeRisco: '3',
    grupoCompatibilidade: 'A',
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.nome, 'Acetona');
  assert.equal(response.body.status, 'ATIVO');
  assert.equal(response.body.descricao, 'Solvente');
  assert.match(response.body.id, /^[0-9a-f-]{36}$/i);
});

test('bloqueia cadastro sem nome', async () => {
  const response = await request('POST', '/produtos-quimicos', { classeRisco: '3' });
  assert.equal(response.status, 400);
});

test('bloqueia cadastro sem classe de risco', async () => {
  const response = await request('POST', '/produtos-quimicos', { nome: 'Acetona' });
  assert.equal(response.status, 400);
});

test('bloqueia status inválido e criação já inativa', async () => {
  assert.equal((await request('POST', '/produtos-quimicos', { nome: 'A', classeRisco: '3', status: 'PENDENTE' })).status, 400);
  assert.equal((await request('POST', '/produtos-quimicos', { nome: 'A', classeRisco: '3', status: 'INATIVO' })).status, 409);
});

test('lista produtos químicos', async () => {
  const created = await createProduto();
  const response = await request('GET', '/produtos-quimicos');
  assert.equal(response.status, 200);
  assert(Array.isArray(response.body));
  assert(response.body.some((item: { id: string }) => item.id === created.id));
});

test('busca produto existente por id', async () => {
  const created = await createProduto();
  const response = await request('GET', `/produtos-quimicos/${created.id}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.id, created.id);
});

test('retorna 404 para produto inexistente', async () => {
  const response = await request('GET', `/produtos-quimicos/${randomUUID()}`);
  assert.equal(response.status, 404);
});

test('atualiza produto químico', async () => {
  const created = await createProduto();
  const response = await request('PUT', `/produtos-quimicos/${created.id}`, {
    nome: 'Nome atualizado',
    classeRisco: '8',
    numeroOnu: '1760',
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.nome, 'Nome atualizado');
  assert.equal(response.body.classeRisco, '8');
  assert.equal(response.body.numeroOnu, '1760');
});

test('inativa produto sem exclusão física nem alteração repetida', async () => {
  const created = await createProduto();
  const first = await request('PATCH', `/produtos-quimicos/${created.id}/inativar`);
  assert.equal(first.status, 200);
  assert.equal(first.body.status, 'INATIVO');
  const second = await request('PATCH', `/produtos-quimicos/${created.id}/inativar`);
  assert.equal(second.status, 200);
  assert.equal(second.body.updatedAt, first.body.updatedAt);
  const persisted = await prisma.produtoQuimico.findUnique({ where: { id: created.id } });
  assert(persisted);
  assert.equal(persisted.status, 'INATIVO');
});
