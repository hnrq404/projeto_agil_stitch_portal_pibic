import path from 'node:path';
import fs from 'node:fs';

import express from 'express';

import { loadEnv } from './infra/config/env';
import { buildApp } from './infra/config/app.container';

loadEnv();

// PORT=0/inválido no ambiente cai no default 3000.
const parsedPort = Number.parseInt(process.env['PORT'] ?? '', 10);
const PORT = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3000;
// Padrão: Firestore (emulador local ou projeto real). PERSISTENCIA=memoria sobe sem banco nenhum.
const PERSISTENCIA = process.env['PERSISTENCIA'] === 'memoria' ? 'memoria' : 'firestore';

const container = buildApp({ persistencia: PERSISTENCIA });

// ── Frontend SPA (web/dist) — mesma origem da API ──────────────────────────
const webDist = path.resolve(__dirname, '..', '..', 'web', 'dist');
if (fs.existsSync(webDist)) {
  container.app.use(express.static(webDist));
  // Fallback SPA: qualquer rota não-API cai no index.html (react-router).
  container.app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
  console.log(`[portal-pibic-server] Servindo SPA de ${webDist}`);
}

const server = container.app.listen(PORT, () => {
  console.log(`[portal-pibic-server] HTTP on http://localhost:${PORT}`);
  console.log(`[portal-pibic-server] Persistência: ${PERSISTENCIA === 'firestore' ? `Firestore (${process.env['FIRESTORE_EMULATOR_HOST'] ? 'emulador' : 'projeto real'})` : 'in-memory'}`);
  console.log('[portal-pibic-server] Contas de demonstração: npm run db:seed (ver README).');
});

// ── Encerramento automático por prazo (S2.3) ───────────────────────────────
// No servidor local roda aqui, a cada minuto. Na Vercel não há processo contínuo:
// a Vercel Cron chama /api/cron/encerrar-editais (ver vercel.json e cron.routes.ts).
const ENCERRAMENTO_INTERVALO_MS = 60_000;
function encerrarEditaisVencidos(): void {
  container.editaisService
    .syncAutomaticClosure()
    .then((encerrados) => {
      if (encerrados > 0) console.log(`[portal-pibic-server] ${encerrados} edital(is) encerrado(s) por prazo.`);
    })
    .catch((error: unknown) => console.error('[portal-pibic-server] Falha no encerramento automático:', error));
}
encerrarEditaisVencidos();
const encerramentoTimer = setInterval(encerrarEditaisVencidos, ENCERRAMENTO_INTERVALO_MS);
encerramentoTimer.unref();

// ── Relatório mensal: lembrete antes do dia 5 e aviso de atraso ────────────
// Cada aviso sai uma vez por mês de referência; checar de hora em hora basta.
const LEMBRETES_INTERVALO_MS = 60 * 60_000;
function enviarLembretesDeRelatorio(): void {
  container.projetosService
    .enviarLembretes()
    .then((enviados) => {
      if (enviados > 0) console.log(`[portal-pibic-server] ${enviados} aviso(s) de relatório mensal enviado(s).`);
    })
    .catch((error: unknown) => console.error('[portal-pibic-server] Falha nos lembretes de relatório:', error));
}
enviarLembretesDeRelatorio();
const lembretesTimer = setInterval(enviarLembretesDeRelatorio, LEMBRETES_INTERVALO_MS);
lembretesTimer.unref();

// ── Desligamento gracioso: termina as requisições em curso e fecha o banco ──
function desligar(sinal: string): void {
  console.log(`[portal-pibic-server] ${sinal} recebido, encerrando...`);
  clearInterval(encerramentoTimer);
  clearInterval(lembretesTimer);
  server.close(() => {
    void Promise.resolve(container.disconnect?.()).finally(() => process.exit(0));
  });
  // Conexões presas (keep-alive) não seguram o processo para sempre.
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.once('SIGTERM', () => desligar('SIGTERM'));
process.once('SIGINT', () => desligar('SIGINT'));

export { container };
