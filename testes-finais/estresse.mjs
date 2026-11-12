// Teste de estresse: leva a API ao limite para achar o ponto de quebra e ver como ela se recupera.
// Só roda localmente (API compilada + emulador do Firestore). Ver README.md desta pasta.
//   node estresse.mjs
import { alvo, espera, exigirLocal, rodar, salvar, tabela, tokens } from './lib.mjs';

const base = alvo();
exigirLocal(base);
const t = await tokens(base);
const auth = (papel) => ({ authorization: `Bearer ${t[papel]}` });

const mistura = [
  { path: '/api/publico/editais' },
  { path: '/api/publico/projetos' },
  { path: '/api/auth/me', headers: auth('discente') },
  { path: '/api/candidaturas/minhas', headers: auth('discente') },
  { path: '/api/inscricoes/minhas', headers: auth('docente') },
  { path: '/api/dashboard/gestor', headers: auth('gestor') },
];

const LIMITE_FALHA_PCT = 5;
const LIMITE_P99_MS = 10_000;
const relatorio = { alvo: base, quando: new Date().toISOString() };

// ── 1. Rampa até o ponto de quebra ───────────────────────────────────────────
console.log(`\n1) Rampa até a quebra (falha > ${LIMITE_FALHA_PCT}% ou p99 > ${LIMITE_P99_MS / 1000} s)`);
const base10 = await rodar({ url: base, connections: 10, duration: 10, requests: mistura });
console.log(`   referência 10 conexões: ${base10.reqPorS} req/s, p50 ${base10.p50} ms, p99 ${base10.p99} ms`);

const rampa = [];
let quebra = null;
for (const n of [50, 100, 200, 400, 800, 1600, 2400, 3200, 4800]) {
  const r = await rodar({ url: base, connections: n, duration: 15, requests: mistura, timeout: 10 });
  rampa.push(r);
  const quebrou = r.taxaFalhaPct > LIMITE_FALHA_PCT || r.p99 >= LIMITE_P99_MS;
  const codigos = Object.keys(r.codigosErro).length ? `  ${JSON.stringify(r.codigosErro)}` : '';
  console.log(
    `   ${String(n).padStart(5)} conexões: ${String(r.reqPorS).padStart(6)} req/s  p50 ${r.p50}  p99 ${r.p99} ms  ` +
      `erros ${r.erros}  timeouts ${r.timeouts}  non2xx ${r.non2xx}  falhas ${r.taxaFalhaPct}%${codigos}${quebrou ? '  ← QUEBRA' : ''}`,
  );
  if (quebrou) {
    quebra = n;
    break;
  }
  // Pausa entre níveis: deixa o sistema operacional liberar as conexões fechadas (TIME_WAIT).
  await espera(5000);
}
relatorio.rampa = { referencia: base10, niveis: rampa, quebraEm: quebra };

// ── 2. Recuperação logo após o pico ──────────────────────────────────────────
console.log('\n2) Recuperação: volta a 10 conexões logo após o pico');
const inicioRec = Date.now();
let recuperou = null;
const amostras = [];
for (let i = 0; i < 12; i++) {
  const r = await rodar({ url: base, connections: 10, duration: 5, requests: mistura });
  amostras.push({ segundos: Math.round((Date.now() - inicioRec) / 1000), ...r });
  console.log(`   t+${amostras.at(-1).segundos}s: ${r.reqPorS} req/s, p99 ${r.p99} ms, falhas ${r.taxaFalhaPct}%`);
  if (r.taxaFalhaPct === 0 && r.p99 <= base10.p99 * 2) {
    recuperou = amostras.at(-1).segundos;
    break;
  }
}
console.log(recuperou !== null ? `   recuperada em ~${recuperou} s` : '   NÃO voltou ao normal em 60 s');
relatorio.recuperacao = { amostras, recuperouEmS: recuperou };

// ── 3. Tempestade de logins: o hash de senha trava as outras rotas? ────────────
// Como no início de um turno no campus: muita gente diferente entrando ao mesmo tempo.
const contasSeed = [
  ['gestor.demo', 'gestor123'],
  ['docente.demo', 'docente123'],
  ['docente2.demo', 'docente123'],
  ['avaliador.demo', 'docente123'],
  ['avaliador2.demo', 'docente123'],
  ['discente.demo', 'discente123'],
  ['bruno.demo', 'discente123'],
  ['julia.demo', 'discente123'],
  ['caio.demo', 'discente123'],
  ['visitante.demo', 'visitante123'],
];
console.log(`\n3) Tempestade de logins (30 simultâneos, ${contasSeed.length} contas) medindo uma rota leve em paralelo`);
const leveSozinha = await rodar({ url: base, connections: 5, duration: 8, requests: [{ path: '/api/health' }] });
// 3 conexões por conta (30 no total): cada pessoa entra uma vez por vez, como no uso real.
// Uma lista única faria as 30 conexões começarem juntas na mesma conta, e o limite por
// conta trata 30 logins simultâneos numa conta só como ataque.
const somarLogins = (partes) => {
  const status = {};
  for (const p of partes) for (const [k, v] of Object.entries(p.status)) status[k] = (status[k] ?? 0) + v;
  const total = partes.reduce((s, p) => s + p.total, 0);
  const falhas = total - (status['200'] ?? 0);
  return {
    total,
    reqPorS: Math.round(partes.reduce((s, p) => s + p.reqPorS, 0) * 10) / 10,
    p50: Math.max(...partes.map((p) => p.p50)),
    p99: Math.max(...partes.map((p) => p.p99)),
    taxaFalhaPct: total ? Math.round((1000 * falhas) / total) / 10 : 0,
    status,
  };
};
const [logins, leveJunto] = await Promise.all([
  Promise.all(
    contasSeed.map(([usuario, senha]) =>
      rodar({
        url: base,
        connections: 3,
        duration: 10,
        timeout: 20,
        requests: [
          {
            method: 'POST',
            path: '/api/auth/login',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: `${usuario}@unicap.br`, senha }),
          },
        ],
      }),
    ),
  ).then(somarLogins),
  espera(1000).then(() =>
    rodar({ url: base, connections: 5, duration: 8, requests: [{ path: '/api/health' }] }),
  ),
]);
console.log(`   logins: ${logins.reqPorS}/s, p50 ${logins.p50} ms, p99 ${logins.p99} ms, falhas ${logins.taxaFalhaPct}%`);
console.log(`   /api/health sozinha:      p50 ${leveSozinha.p50} ms  p99 ${leveSozinha.p99} ms  ${leveSozinha.reqPorS} req/s`);
console.log(`   /api/health com logins:   p50 ${leveJunto.p50} ms  p99 ${leveJunto.p99} ms  ${leveJunto.reqPorS} req/s`);
relatorio.logins = { logins, leveSozinha, leveJunto };

// ── 4. Falta de recursos: corpos gigantes ────────────────────────────────────
console.log('\n4) Corpos acima do limite (2 MB de JSON) em rajada');
const grande = JSON.stringify({ email: 'x@unicap.br', senha: 'a'.repeat(2 * 1024 * 1024) });
const corpo = await rodar({
  url: base,
  connections: 20,
  duration: 8,
  requests: [{ method: 'POST', path: '/api/auth/login', headers: { 'Content-Type': 'application/json' }, body: grande }],
});
const saudeDepois = await fetch(`${base}/api/health`).then((r) => r.status).catch(() => 'sem resposta');
console.log(`   respostas: ${JSON.stringify(corpo.status)}  erros ${corpo.erros}  → /api/health depois: ${saudeDepois}`);
relatorio.corpoGrande = { ...corpo, saudeDepois };

salvar('estresse-local.json', relatorio);
const md = [
  '### Rampa até a quebra (mistura de rotas, 15 s por nível)',
  '',
  tabela([{ ...base10, conexoes: '10 (ref.)' }, ...rampa], [
    { titulo: 'Conexões', valor: (l) => l.conexoes },
    { titulo: 'req/s', valor: (l) => l.reqPorS },
    { titulo: 'p50 (ms)', valor: (l) => l.p50 },
    { titulo: 'p99 (ms)', valor: (l) => l.p99 },
    { titulo: 'Erros', valor: (l) => l.erros },
    { titulo: 'Timeouts', valor: (l) => l.timeouts },
    { titulo: 'Não-2xx', valor: (l) => l.non2xx },
    { titulo: 'Falhas', valor: (l) => `${l.taxaFalhaPct}%` },
  ]),
  '',
  `Ponto de quebra: ${quebra ? `${quebra} conexões simultâneas` : 'não atingido'}. ` +
    `Recuperação: ${recuperou !== null ? `~${recuperou} s` : 'não recuperou em 60 s'}.`,
  '',
].join('\n');
console.log(`\nResultados salvos em ${salvar('estresse-local.md', md)}`);
