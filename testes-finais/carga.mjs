// Teste de carga: velocidade, estabilidade e tempo de resposta em uso normal e com muitos usuários.
// Só roda localmente (API compilada + emulador do Firestore). Ver README.md desta pasta.
//   node carga.mjs
import { alvo, exigirLocal, rodar, salvar, tabela, tokens } from './lib.mjs';

const base = alvo();
exigirLocal(base);
const json = { 'Content-Type': 'application/json' };

const t = await tokens(base);
const auth = (papel) => ({ authorization: `Bearer ${t[papel]}` });

const ROTAS = [
  { nome: 'Site (index.html)', path: '/' },
  { nome: 'Saúde + banco', path: '/api/health/ready' },
  { nome: 'Editais abertos (público)', path: '/api/publico/editais' },
  { nome: 'Projetos com vaga (público)', path: '/api/publico/projetos' },
  { nome: 'Vitrine de pesquisas (público)', path: '/api/publico/pesquisas' },
  { nome: 'Sessão /me (aluno)', path: '/api/auth/me', headers: auth('discente') },
  { nome: 'Notificações não lidas (aluno)', path: '/api/notificacoes/nao-lidas', headers: auth('discente') },
  { nome: 'Minhas candidaturas (aluno)', path: '/api/candidaturas/minhas', headers: auth('discente') },
  { nome: 'Meus projetos (professor)', path: '/api/inscricoes/minhas', headers: auth('docente') },
  { nome: 'Minhas avaliações (professor)', path: '/api/avaliacoes/minhas', headers: auth('docente') },
  { nome: 'Painel do gestor', path: '/api/dashboard/gestor', headers: auth('gestor') },
  { nome: 'Triagem (gestor)', path: '/api/triagem', headers: auth('gestor') },
  {
    nome: 'Login (hash de senha)',
    path: '/api/auth/login',
    method: 'POST',
    headers: json,
    body: JSON.stringify({ email: 'discente.demo@unicap.br', senha: 'discente123' }),
  },
];

const CONEXOES_BASE = 10;
const DURACAO_BASE = 10;

console.log(`\nTeste de carga em ${base}\n`);
console.log(`Fase 1: linha de base por rota (${CONEXOES_BASE} conexões simultâneas, ${DURACAO_BASE} s cada)`);

const porRota = [];
for (const r of ROTAS) {
  const res = await rodar({
    url: base,
    connections: CONEXOES_BASE,
    duration: DURACAO_BASE,
    requests: [{ method: r.method ?? 'GET', path: r.path, headers: r.headers, body: r.body }],
  });
  porRota.push({ rota: r.nome, ...res });
  console.log(
    `  ${r.nome.padEnd(34)} ${String(res.reqPorS).padStart(7)} req/s  p50 ${res.p50} ms  p99 ${res.p99} ms  falhas ${res.taxaFalhaPct}%`,
  );
}

// Fase 2: uso misto, como num dia de edital aberto: cada conexão percorre a jornada de vários perfis.
const mistura = [
  { method: 'GET', path: '/api/publico/editais' },
  { method: 'GET', path: '/api/publico/projetos' },
  { method: 'GET', path: '/api/auth/me', headers: auth('discente') },
  { method: 'GET', path: '/api/candidaturas/minhas', headers: auth('discente') },
  { method: 'GET', path: '/api/notificacoes/nao-lidas', headers: auth('discente') },
  { method: 'GET', path: '/api/publico/pesquisas' },
  { method: 'GET', path: '/api/inscricoes/minhas', headers: auth('docente') },
  { method: 'GET', path: '/api/avaliacoes/minhas', headers: auth('docente') },
  { method: 'GET', path: '/api/dashboard/gestor', headers: auth('gestor') },
  { method: 'GET', path: '/api/auth/me', headers: auth('visitante') },
];

const NIVEIS = [10, 50, 100];
const DURACAO_MISTA = 20;
console.log(`\nFase 2: uso misto (${NIVEIS.join(', ')} conexões, ${DURACAO_MISTA} s cada)`);
const misto = [];
for (const n of NIVEIS) {
  const res = await rodar({ url: base, connections: n, duration: DURACAO_MISTA, requests: mistura });
  misto.push(res);
  console.log(
    `  ${String(n).padStart(4)} conexões  ${String(res.reqPorS).padStart(7)} req/s  média ${res.latMediaMs} ms  p50 ${res.p50}  p90 ${res.p90}  p99 ${res.p99} ms  falhas ${res.taxaFalhaPct}%`,
  );
}

salvar('carga-local.json', { alvo: base, quando: new Date().toISOString(), porRota, misto });
const md = [
  `### Linha de base por rota (${CONEXOES_BASE} conexões, ${DURACAO_BASE} s)`,
  '',
  tabela(porRota, [
    { titulo: 'Rota', valor: (l) => l.rota },
    { titulo: 'req/s', valor: (l) => l.reqPorS },
    { titulo: 'p50 (ms)', valor: (l) => l.p50 },
    { titulo: 'p90 (ms)', valor: (l) => l.p90 },
    { titulo: 'p99 (ms)', valor: (l) => l.p99 },
    { titulo: 'Falhas', valor: (l) => `${l.taxaFalhaPct}%` },
  ]),
  '',
  `### Uso misto (${DURACAO_MISTA} s por nível)`,
  '',
  tabela(misto, [
    { titulo: 'Conexões', valor: (l) => l.conexoes },
    { titulo: 'Requisições', valor: (l) => l.total },
    { titulo: 'req/s', valor: (l) => l.reqPorS },
    { titulo: 'Média (ms)', valor: (l) => l.latMediaMs },
    { titulo: 'p50', valor: (l) => l.p50 },
    { titulo: 'p90', valor: (l) => l.p90 },
    { titulo: 'p99', valor: (l) => l.p99 },
    { titulo: 'Falhas', valor: (l) => `${l.taxaFalhaPct}%` },
  ]),
  '',
].join('\n');
console.log(`\nResultados salvos em ${salvar('carga-local.md', md)}`);
