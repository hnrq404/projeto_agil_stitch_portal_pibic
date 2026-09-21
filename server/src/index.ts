import path from 'node:path';
import fs from 'node:fs';

import { loadEnv } from './infra/config/env';
import { buildApp } from './infra/config/app.container';

loadEnv();

// PORT=0/inválido no ambiente cai no default 3000.
const parsedPort = Number.parseInt(process.env['PORT'] ?? '', 10);
const PORT = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3000;
const USE_PRISMA = process.env['USE_PRISMA'] !== 'false'; // padrão: persistência REAL

const container = buildApp({ usePrisma: USE_PRISMA });

// ── Frontend SPA (web/dist) — mesma origem da API ──────────────────────────
const webDist = path.resolve(__dirname, '..', '..', 'web', 'dist');
if (fs.existsSync(webDist)) {
  const express = require('express') as typeof import('express');
  container.app.use(express.static(webDist));
  // Fallback SPA: qualquer rota não-API cai no index.html (react-router).
  container.app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
  console.log(`[portal-pibic-server] Servindo SPA de ${webDist}`);
}

container.app.listen(PORT, () => {
  console.log(`[portal-pibic-server] HTTP on http://localhost:${PORT}`);
  console.log(`[portal-pibic-server] Persistência: ${USE_PRISMA ? 'Prisma/SQLite (real)' : 'in-memory'}`);
  console.log('[portal-pibic-server] Fluxo: /cadastro → /login → /gestor/editais ou /editais (vitrine)');
});

export { container };
