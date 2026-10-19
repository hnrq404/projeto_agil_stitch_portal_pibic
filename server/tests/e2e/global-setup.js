const { execSync } = require('node:child_process');
const path = require('node:path');

const { E2E_DATABASE_URL } = require('./e2e-db');

/** Cria/atualiza o schema no e2e.db antes da suíte (o dev.db não é tocado). */
module.exports = function globalSetup() {
  execSync('npx prisma db push --skip-generate --accept-data-loss --schema src/infra/prisma/schema.prisma', {
    cwd: path.resolve(__dirname, '../..'),
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
    stdio: 'ignore',
  });
};
