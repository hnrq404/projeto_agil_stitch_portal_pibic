// Smoke test: percorre o caminho crítico de cada perfil para validar uma versão nova.
//   node smoke.mjs                      → build local completa (API servindo o site), com logins
//   node smoke.mjs --url=https://...    → depois de um deploy: só leituras públicas, sem login
//                                         (uma dúzia de requisições, nada é gravado)
import { alvo, CONTAS, ehLocal, salvar, tabela } from './lib.mjs';

const base = alvo();
const local = ehLocal(base);
const resultados = [];

async function req(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const inicio = Date.now();
  const r = await fetch(`${base}${path}`, { method, headers, body: body && JSON.stringify(body) });
  const texto = await r.text();
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch {
    /* HTML ou CSV */
  }
  return { status: r.status, json, texto, tipo: r.headers.get('content-type') ?? '', ms: Date.now() - inicio };
}

async function passo(area, nome, fn) {
  try {
    const detalhe = await fn();
    resultados.push({ area, nome, ok: true, detalhe: detalhe ?? '' });
    console.log(`  ✓ ${area.padEnd(10)} ${nome}${detalhe ? `  (${detalhe})` : ''}`);
  } catch (e) {
    resultados.push({ area, nome, ok: false, detalhe: e.message });
    console.log(`  ✗ ${area.padEnd(10)} ${nome}  → ${e.message}`);
  }
}
function exigir(cond, msg) {
  if (!cond) throw new Error(msg);
}
const status = (r, esperado) => exigir(r.status === esperado, `HTTP ${r.status}, esperado ${esperado}`);

console.log(`\nSmoke test em ${base} (${local ? 'completo' : 'só leituras públicas'})\n`);

// ── Site e saúde ─────────────────────────────────────────────────────────────
await passo('Site', 'Página inicial carrega o app', async () => {
  const r = await req('GET', '/');
  status(r, 200);
  exigir(r.texto.includes('id="root"'), 'HTML sem o <div id="root">');
  const js = /src="(\/assets\/[^"]+\.js)"/.exec(r.texto)?.[1];
  exigir(js, 'nenhum script /assets/*.js no HTML');
  status(await req('GET', js), 200);
  return `${r.ms} ms`;
});
for (const rota of ['/login', '/cadastro', '/editais', '/pesquisas']) {
  await passo('Site', `Rota da SPA ${rota}`, async () => status(await req('GET', rota), 200));
}
await passo('Saúde', 'API e banco prontos', async () => {
  const r = await req('GET', '/api/health/ready');
  status(r, 200);
  exigir(r.json?.banco === 'ok' || r.json?.banco === 'memoria', `banco: ${r.json?.banco}`);
  return `banco ${r.json.banco}, ${r.ms} ms`;
});

// ── Parte pública ────────────────────────────────────────────────────────────
let editalId;
await passo('Público', 'Editais abertos', async () => {
  const r = await req('GET', '/api/publico/editais');
  status(r, 200);
  editalId = r.json.data[0]?.id;
  return `${r.json.total} edital(is)`;
});
if (editalId) {
  await passo('Público', 'Detalhe do edital', async () => status(await req('GET', `/api/publico/editais/${editalId}`), 200));
}
await passo('Público', 'Projetos com vaga', async () => {
  const r = await req('GET', '/api/publico/projetos');
  status(r, 200);
  return `${r.json.total} projeto(s)`;
});
await passo('Público', 'Vitrine de pesquisas', async () => {
  const r = await req('GET', '/api/publico/pesquisas');
  status(r, 200);
  exigir(!/"email"|matricula/.test(r.texto), 'vitrine expõe e-mail ou matrícula');
  return `${r.json.total} pesquisa(s), sem dados pessoais`;
});
await passo('Público', 'Áreas do CNPq', async () => status(await req('GET', '/api/cnpq/areas'), 200));
await passo('Segurança', 'Área logada exige login', async () => status(await req('GET', '/api/auth/me'), 401));
await passo('Segurança', 'Rota inexistente responde JSON', async () => {
  const r = await req('GET', '/api/nao-existe');
  status(r, 404);
  exigir(r.json?.error, 'resposta não é JSON');
});

// ── Perfis (só local: as contas de demonstração vêm do seed) ────────────────────
if (local) {
  const entrar = async (conta, papel) => {
    const r = await req('POST', '/api/auth/login', { body: conta });
    status(r, 200);
    exigir(r.json.usuario.role === papel, `papel ${r.json.usuario.role}, esperado ${papel}`);
    return r.json.token;
  };

  const gestor = await entrar(CONTAS.gestor, 'GESTOR');
  await passo('Gestor', 'Painel com indicadores', async () => {
    const r = await req('GET', '/api/dashboard/gestor', { token: gestor });
    status(r, 200);
  });
  for (const [nome, rota] of [
    ['Gestão de editais', '/api/editais'],
    ['Central de triagem', '/api/triagem'],
    ['Gestão de usuários', '/api/usuarios'],
    ['Auditoria', '/api/auditoria'],
    ['Projetos em andamento', '/api/projetos'],
  ]) {
    await passo('Gestor', nome, async () => status(await req('GET', rota, { token: gestor }), 200));
  }
  await passo('Gestor', 'Exportação CSV', async () => {
    const r = await req('GET', '/api/projetos/exportacao.csv', { token: gestor });
    status(r, 200);
    exigir(r.tipo.includes('text/csv'), `Content-Type ${r.tipo}`);
  });

  const docente = await entrar(CONTAS.docente, 'DOCENTE');
  let divulgado;
  await passo('Professor', 'Meus projetos', async () => {
    const r = await req('GET', '/api/inscricoes/minhas', { token: docente });
    status(r, 200);
    divulgado = r.json.data.find((p) => p.status === 'DIVULGADA');
    return `${r.json.data.length} projeto(s)`;
  });
  if (divulgado) {
    await passo('Professor', 'Candidatos do projeto divulgado', async () => {
      const r = await req('GET', `/api/inscricoes/${divulgado.id}/candidaturas`, { token: docente });
      status(r, 200);
      const c = r.json.data?.[0];
      if (c) status(await req('GET', `/api/inscricoes/${divulgado.id}/candidaturas/${c.id}/curriculo`, { token: docente }), 200);
      return `${r.json.data.length} candidato(s), Lattes acessível`;
    });
  }
  await passo('Professor', 'Minhas avaliações', async () => status(await req('GET', '/api/avaliacoes/minhas', { token: docente }), 200));
  await passo('Professor', 'Lista de professores para indicar', async () =>
    status(await req('GET', '/api/usuarios/docentes', { token: docente }), 200),
  );

  const discente = await entrar(CONTAS.discente, 'DISCENTE');
  await passo('Aluno', 'Minhas candidaturas', async () => status(await req('GET', '/api/candidaturas/minhas', { token: discente }), 200));
  await passo('Aluno', 'Meu projeto de bolsa', async () => {
    const r = await req('GET', '/api/projetos', { token: discente });
    status(r, 200);
    const projeto = r.json.data?.[0];
    if (projeto) status(await req('GET', `/api/projetos/${projeto.id}`, { token: discente }), 200);
  });
  await passo('Aluno', 'Notificações', async () => status(await req('GET', '/api/notificacoes', { token: discente }), 200));
  await passo('Aluno', 'Currículo Lattes no perfil', async () => {
    const r = await req('GET', '/api/perfil/curriculo', { token: discente });
    status(r, 200);
    exigir(r.json.url, 'sem link do currículo');
  });

  const visitante = await entrar(CONTAS.visitante, 'USUARIO');
  await passo('Visitante', 'Sessão ativa', async () => status(await req('GET', '/api/auth/me', { token: visitante }), 200));
  await passo('Visitante', 'Sem acesso à gestão', async () => status(await req('GET', '/api/dashboard/gestor', { token: visitante }), 403));

  // Cadastro com confirmação por e-mail (só com a API em modo desenvolvimento, que guarda os e-mails).
  const emails = await req('GET', '/api/dev/emails');
  if (emails.status === 200) {
    await passo('Cadastro', 'Cria conta @unicap.br, confirma pelo link e entra', async () => {
      const email = `smoke.${Date.now()}@unicap.br`;
      status(await req('POST', '/api/auth/register', { body: { nome: 'Smoke Test', email, senha: 'SenhaSmoke123', role: 'USUARIO' } }), 201);
      const msg = (await req('GET', '/api/dev/emails')).json.data.find((e) => e.para === email);
      const token = decodeURIComponent(/token=([^\s"&<]+)/.exec(msg?.texto ?? '')?.[1] ?? '');
      status(await req('POST', '/api/auth/verificar-email', { body: { token } }), 200);
      status(await req('POST', '/api/auth/login', { body: { email, senha: 'SenhaSmoke123' } }), 200);
    });
  }
}

const falhas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - falhas.length}/${resultados.length} passos OK${falhas.length ? ` — ${falhas.length} FALHA(S)` : ''}`);
const nome = local ? 'smoke-local' : 'smoke-producao';
salvar(`${nome}.json`, resultados);
salvar(
  `${nome}.md`,
  tabela(resultados, [
    { titulo: 'Área', valor: (l) => l.area },
    { titulo: 'Passo', valor: (l) => l.nome },
    { titulo: 'Resultado', valor: (l) => (l.ok ? `✅ ${l.detalhe}` : `❌ ${l.detalhe}`) },
  ]) + '\n',
);
process.exit(falhas.length ? 1 : 0);
