// Utilitários compartilhados pelos testes finais (carga, estresse, segurança e smoke).
import autocannon from 'autocannon';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PASTA = path.dirname(fileURLToPath(import.meta.url));

/** URL alvo: argumento --url=..., variável ALVO ou a API local da porta 3100. */
export function alvo() {
  const arg = process.argv.find((a) => a.startsWith('--url='));
  return (arg?.slice(6) ?? process.env.ALVO ?? 'http://localhost:3100').replace(/\/+$/, '');
}

export function ehLocal(url) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url);
}

/** Carga e estresse só rodam na máquina local: nunca contra a Vercel (firewall anti-DDoS e cota do Firestore). */
export function exigirLocal(url) {
  if (!ehLocal(url)) {
    console.error(`Recusado: ${url} não é local. Testes de carga e estresse só rodam contra a API local.`);
    process.exit(2);
  }
}

/** Contas do seed (npm run db:seed). Senha = papel + 123. */
export const CONTAS = {
  gestor: { email: 'gestor.demo@unicap.br', senha: 'gestor123' },
  docente: { email: 'docente.demo@unicap.br', senha: 'docente123' },
  discente: { email: 'discente.demo@unicap.br', senha: 'discente123' },
  visitante: { email: 'visitante.demo@unicap.br', senha: 'visitante123' },
};

export async function login(base, conta) {
  const r = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(conta),
  });
  if (r.status !== 200) throw new Error(`Login de ${conta.email} falhou: HTTP ${r.status}`);
  return (await r.json()).token;
}

export async function tokens(base) {
  const t = {};
  for (const [papel, conta] of Object.entries(CONTAS)) t[papel] = await login(base, conta);
  return t;
}

/** Roda o autocannon e devolve só as métricas que interessam ao relatório. */
export function rodar({ url, connections, duration, requests, amount, timeout = 10, pipelining = 1 }) {
  return new Promise((resolve, reject) => {
    const codigosErro = {};
    const inst = autocannon(
      { url, connections, duration, amount, requests, timeout, pipelining },
      (err, r) => {
        if (err) return reject(err);
        const total = r.requests.total;
        // `errors` do autocannon já inclui os timeouts.
        const falhas = r.errors + r.non2xx;
        resolve({
          conexoes: connections,
          duracaoS: duration ?? null,
          total,
          reqPorS: round(r.requests.average),
          latMediaMs: round(r.latency.average),
          p50: r.latency.p50,
          p90: r.latency.p90,
          p99: r.latency.p99,
          maxMs: r.latency.max,
          erros: r.errors,
          timeouts: r.timeouts,
          non2xx: r.non2xx,
          taxaFalhaPct: total + r.errors ? round((100 * falhas) / (total + r.errors)) : 0,
          status: Object.fromEntries(Object.entries(r.statusCodeStats ?? {}).map(([k, v]) => [k, v.count])),
          codigosErro,
        });
      },
    );
    inst.on('reqError', (err) => {
      const codigo = err.code ?? err.message;
      codigosErro[codigo] = (codigosErro[codigo] ?? 0) + 1;
    });
    autocannon.track(inst, { renderProgressBar: false, renderResultsTable: false, renderLatencyTable: false });
  });
}

function round(n) {
  return Math.round(n * 10) / 10;
}

export function tabela(linhas, colunas) {
  const cab = `| ${colunas.map((c) => c.titulo).join(' | ')} |`;
  const sep = `|${colunas.map(() => '---').join('|')}|`;
  const corpo = linhas.map((l) => `| ${colunas.map((c) => c.valor(l)).join(' | ')} |`);
  return [cab, sep, ...corpo].join('\n');
}

export function salvar(nome, dados) {
  const pasta = path.join(PASTA, 'resultados');
  fs.mkdirSync(pasta, { recursive: true });
  const arquivo = path.join(pasta, nome);
  fs.writeFileSync(arquivo, typeof dados === 'string' ? dados : JSON.stringify(dados, null, 2));
  return arquivo;
}

export const espera = (ms) => new Promise((r) => setTimeout(r, ms));
