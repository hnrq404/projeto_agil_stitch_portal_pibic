import { buildApp } from './infra/config/app.container';
import { createSeedUserDirectory } from './infra/auth/seed.users';

const PORT = Number(process.env['PORT'] ?? 3000);

const container = buildApp({
  userDirectory: createSeedUserDirectory(),
});

container.app.listen(PORT, () => {
  console.log(`[portal-pibic-server] HTTP on http://localhost:${PORT}`);
  console.log('[portal-pibic-server] Tokens de seed: gestor-token | avaliador-token | discente-token | docente-token');
});

export { container };
