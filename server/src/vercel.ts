import { loadEnv } from './infra/config/env';
import { buildApp } from './infra/config/app.container';

/**
 * Entrada da função serverless na Vercel (api/index.js na raiz do repositório).
 * O container é montado uma vez por instância e reaproveitado nas invocações
 * seguintes. Aqui não há app.listen, arquivos estáticos (a Vercel serve o
 * web/dist) nem timers (a Vercel Cron chama /api/cron/...).
 */
loadEnv();

export const { app } = buildApp({ persistencia: 'firestore' });
