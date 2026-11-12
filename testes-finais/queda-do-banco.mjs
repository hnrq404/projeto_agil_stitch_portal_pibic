// Estresse por falta de recurso: o banco cai com a API no ar e depois volta.
// Durante todo o teste, sonda a API a cada 500 ms e registra o comportamento.
//   node queda-do-banco.mjs   (em outro terminal: pare o emulador quando pedido e suba de novo depois)
// Os testes finais orquestram a queda automaticamente; aqui só fica a sonda.
import { alvo, espera, exigirLocal, salvar } from './lib.mjs';

const base = alvo();
exigirLocal(base);
const duracaoS = Number(process.argv.find((a) => a.startsWith('--segundos='))?.slice(11) ?? 90);

async function sondar(path) {
  const inicio = Date.now();
  try {
    const r = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(30_000) });
    return { status: r.status, ms: Date.now() - inicio };
  } catch (e) {
    return { status: e.name === 'TimeoutError' ? 'timeout' : 'sem resposta', ms: Date.now() - inicio };
  }
}

const linhas = [];
const fim = Date.now() + duracaoS * 1000;
const t0 = Date.now();
while (Date.now() < fim) {
  const [saude, pronto, editais] = await Promise.all([
    sondar('/api/health'),
    sondar('/api/health/ready'),
    sondar('/api/publico/editais'),
  ]);
  const l = { s: Math.round((Date.now() - t0) / 100) / 10, saude, pronto, editais };
  linhas.push(l);
  console.log(
    `t=${String(l.s).padStart(5)}s  /health ${saude.status} (${saude.ms} ms)  /ready ${pronto.status} (${pronto.ms} ms)  /editais ${editais.status} (${editais.ms} ms)`,
  );
  await espera(500);
}
console.log(`\nResultados salvos em ${salvar('queda-do-banco.json', linhas)}`);
