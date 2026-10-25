import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { after, before, test } from 'node:test';
import { app } from '../src/app.js';

let server: Server;
let baseUrl: string;

before(async () => {
  server = createServer(app);
  await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const address = server.address();
  assert(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
});

async function specification(): Promise<any> {
  const response = await fetch(`${baseUrl}/api/docs/openapi.json`);
  assert.equal(response.status, 200);
  return response.json();
}

test('GET /api/docs apresenta Swagger UI', async () => {
  const response = await fetch(`${baseUrl}/api/docs`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /text\/html/);
  assert.match(await response.text(), /Swagger UI/i);
});

test('Swagger UI serve seus assets locais', async () => {
  const response = await fetch(`${baseUrl}/api/docs/swagger-ui-bundle.js`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /javascript/);
});

test('especificação OpenAPI está disponível em JSON', async () => {
  const doc = await specification();
  assert.match(doc.openapi, /^3\./);
  assert.equal(doc.info.title, 'QuimiPort API');
  assert.equal(doc.info.version, '1.0.0');
  assert.equal(doc.servers[0].url, 'http://localhost:3000');
});

test('documenta todos os endpoints de Produto Químico', async () => {
  const paths = (await specification()).paths;
  assert(paths['/produtos-quimicos'].post);
  assert(paths['/produtos-quimicos'].get);
  assert(paths['/produtos-quimicos/{id}'].get);
  assert(paths['/produtos-quimicos/{id}'].put);
  assert(paths['/produtos-quimicos/{id}/inativar'].patch);
});

test('documenta todos os endpoints de Carga Química', async () => {
  const paths = (await specification()).paths;
  assert(paths['/cargas-quimicas'].post);
  assert(paths['/cargas-quimicas'].get);
  assert(paths['/cargas-quimicas/{id}'].get);
  for (const action of ['status', 'bloquear', 'liberar', 'cancelar']) {
    assert(paths[`/cargas-quimicas/{id}/${action}`].patch);
  }
});

test('documenta exatamente os oito status de Carga e o fluxo atual', async () => {
  const doc = await specification();
  assert.deepEqual(doc.components.schemas.CargaStatus.enum, [
    'REGISTRADA', 'EM_ANALISE', 'EM_INSPECAO', 'LIBERADA', 'BLOQUEADA',
    'EM_MOVIMENTACAO', 'FINALIZADA', 'CANCELADA',
  ]);
  const description = doc.components.schemas.CargaStatus.description;
  assert.match(description, /REGISTRADA → EM_ANALISE/);
  assert.match(description, /BLOQUEADA → CANCELADA/);
  assert.doesNotMatch(description, /BLOQUEADA → EM_ANALISE/);
});

test('schema reutilizável de erro contém code e message', async () => {
  const schema = (await specification()).components.schemas.ApiError;
  assert.deepEqual(schema.required, ['error']);
  assert.deepEqual(schema.properties.error.required, ['code', 'message']);
  assert(schema.properties.error.properties.code);
  assert(schema.properties.error.properties.message);
});

test('quantidade é string decimal na entrada e na saída', async () => {
  const schemas = (await specification()).components.schemas;
  assert.equal(schemas.CreateCargaQuimicaInput.properties.quantidade.type, 'string');
  assert.equal(schemas.CargaQuimica.properties.quantidade.type, 'string');
});

test('status não é aceito no DTO de criação de Carga', async () => {
  const schema = (await specification()).components.schemas.CreateCargaQuimicaInput;
  assert.equal(Object.hasOwn(schema.properties, 'status'), false);
});

test('responses documentam sucessos e erros no formato comum', async () => {
  const doc = await specification();
  assert(doc.paths['/produtos-quimicos'].post.responses['201']);
  assert(doc.paths['/cargas-quimicas'].post.responses['201']);
  for (const status of ['400', '404', '409', '500']) {
    assert(doc.paths['/cargas-quimicas/{id}/status'].patch.responses[status]);
  }
  assert(doc.components.responses.ProdutoNaoEncontrado);
  assert(doc.components.responses.CargaNaoEncontrada);
  assert(doc.components.responses.ProdutoInativo);
  assert(doc.components.responses.CodigoCargaDuplicado);
  assert(doc.components.responses.TransicaoInvalida);
  assert(doc.components.responses.DocumentacaoAusente);
});

test('todas as referências OpenAPI apontam para componentes existentes', async () => {
  const doc = await specification();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const object = value as Record<string, unknown>;
    if (typeof object.$ref === 'string') {
      assert(object.$ref.startsWith('#/components/'));
      const target = object.$ref.slice(2).split('/').reduce<unknown>((part, key) =>
        part && typeof part === 'object' ? (part as Record<string, unknown>)[key] : undefined, doc);
      assert(target, `Referência ausente: ${object.$ref}`);
    }
    Object.values(object).forEach(visit);
  };
  visit(doc);
});

test('documentação não altera GET /health', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});
