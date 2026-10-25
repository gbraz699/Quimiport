import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { createApp } from '../../src/app.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaProdutoQuimicoRepository } from '../../src/infrastructure/repositories/PrismaProdutoQuimicoRepository.js';
import { PrismaCargaQuimicaRepository } from '../../src/infrastructure/repositories/PrismaCargaQuimicaRepository.js';

export function createIsolatedPostgresApp(label: string) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL é necessária para os testes de integração');
  if (!/^[a-z_]+$/.test(label)) throw new Error('Nome de schema de teste inválido');

  const schema = `test_${label}_${randomUUID().replaceAll('-', '')}`;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }, { schema }) });
  const produtos = new PrismaProdutoQuimicoRepository(prisma);
  const cargas = new PrismaCargaQuimicaRepository(prisma);
  const admin = new Client({ connectionString: databaseUrl });
  let connected = false;
  let schemaCreated = false;
  let server: Server | undefined;

  return {
    prisma,
    produtos,
    cargas,
    async start(): Promise<string> {
      await admin.connect();
      connected = true;
      await admin.query(`CREATE SCHEMA "${schema}"`);
      schemaCreated = true;
      await admin.query(`SET search_path TO "${schema}", public`);
      await admin.query(readFileSync(resolve('prisma/migrations/20261025013238_init/migration.sql'), 'utf8'));

      server = createServer(createApp(produtos, cargas));
      await new Promise<void>((resolveListen) => server!.listen(0, '127.0.0.1', resolveListen));
      const address = server.address();
      assert(address && typeof address !== 'string');
      return `http://127.0.0.1:${address.port}`;
    },
    async stop(): Promise<void> {
      try {
        if (server?.listening) await new Promise<void>((resolveClose) => server!.close(() => resolveClose()));
      } finally {
        try {
          await prisma.$disconnect();
        } finally {
          if (connected) {
            try {
              if (schemaCreated) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
            } finally {
              await admin.end();
            }
          }
        }
      }
    },
  };
}
