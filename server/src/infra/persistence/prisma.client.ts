import { PrismaClient } from '@prisma/client';

/**
 * Cliente Prisma compartilhado pela aplicação (SQLite em dev; PostgreSQL em
 * produção trocando o datasource no schema). Os repositórios Prisma recebem o
 * client por injeção, facilitando cleanup nos testes.
 */
export type { PrismaClient };

export function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env['NODE_ENV'] === 'test' ? [] : ['warn', 'error'],
  });
}
