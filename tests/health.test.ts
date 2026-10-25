import { createServer } from 'node:http';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import test from 'node:test';
import { app } from '../src/app.js';

test('GET /health confirma que a API está disponível', async () => {
  const server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    const address = server.address();
    assert(address && typeof address !== 'string');
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  } finally {
    server.close();
    await once(server, 'close');
  }
});
