/**
 * Banco exclusivo dos E2E de API. Os testes limpam as tabelas, então nunca
 * podem apontar para o dev.db (onde ficam as contas do seed). Caminho relativo
 * ao schema.prisma: src/infra/prisma/e2e.db.
 */
const E2E_DATABASE_URL = 'file:./e2e.db';

function useE2eDatabase() {
  // Definido antes do loadEnv(), que não sobrescreve variáveis já presentes.
  process.env.DATABASE_URL = E2E_DATABASE_URL;
}

module.exports = { E2E_DATABASE_URL, useE2eDatabase };
