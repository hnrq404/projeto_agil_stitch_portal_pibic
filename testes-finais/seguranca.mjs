// Teste de segurança: autenticação, autorização (RBAC e IDOR), validação de entrada, arquivos,
// links enviados por e-mail, configuração e força bruta.
// Roda contra a API LOCAL em modo desenvolvimento (precisa de /api/dev/emails para ler os links).
//   NODE_ENV=development JWT_SECRET=... CRON_SECRET=... node dist/index.js   (ver README.md)
//   JWT_SECRET=<o mesmo> CRON_SECRET=<o mesmo> node seguranca.mjs
import { createHmac, randomUUID } from 'node:crypto';

import { alvo, CONTAS, exigirLocal, login, salvar, tabela } from './lib.mjs';

const base = alvo();
exigirLocal(base);
const SEGREDO_JWT = process.env.JWT_SECRET ?? 'teste-local-de-seguranca-com-um-segredo-bem-comprido-123';
const SEGREDO_CRON = process.env.CRON_SECRET ?? 'segredo-de-cron-local-para-teste';

// ── Utilitários ──────────────────────────────────────────────────────────────
async function req(method, path, { token, body, headers = {}, raw } = {}) {
  const h = { ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  let corpo = raw;
  if (body !== undefined) {
    h['Content-Type'] = 'application/json';
    corpo = JSON.stringify(body);
  }
  const r = await fetch(`${base}${path}`, { method, headers: h, body: corpo, redirect: 'manual' });
  const texto = await r.text();
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch {
    /* corpo não JSON */
  }
  return { status: r.status, json, texto, headers: r.headers };
}

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
function jwt(payload, segredo, alg = 'HS256') {
  const cab = b64({ alg, typ: 'JWT' });
  const corpo = b64(payload);
  if (alg === 'none') return `${cab}.${corpo}.`;
  const sig = createHmac('sha256', segredo).update(`${cab}.${corpo}`).digest('base64url');
  return `${cab}.${corpo}.${sig}`;
}

async function ultimoEmail(para) {
  const r = await req('GET', '/api/dev/emails');
  return r.json?.data?.find((e) => e.para === para);
}
const tokenDoLink = (email) => decodeURIComponent(/token=([^\s"&<]+)/.exec(email?.texto ?? '')?.[1] ?? '');

const resultados = [];
function registrar(grupo, id, descricao, esperado, obtido, ok, severidade = 'alta') {
  resultados.push({ grupo, id, descricao, esperado, obtido: String(obtido), ok, severidade });
  console.log(`  ${ok ? 'PASSOU' : 'FALHOU'}  ${id.padEnd(4)} ${descricao}  → ${obtido}`);
}
const st = (r) => r.status;

// ── Preparação: sessões e ids do seed ────────────────────────────────────────
const t = {};
for (const [papel, conta] of Object.entries(CONTAS)) t[papel] = await login(base, conta);
t.docente2 = await login(base, { email: 'docente2.demo@unicap.br', senha: 'docente123' });
t.avaliador = await login(base, { email: 'avaliador.demo@unicap.br', senha: 'docente123' });
t.avaliador2 = await login(base, { email: 'avaliador2.demo@unicap.br', senha: 'docente123' });
t.bruno = await login(base, { email: 'bruno.demo@unicap.br', senha: 'discente123' });
t.julia = await login(base, { email: 'julia.demo@unicap.br', senha: 'discente123' });

const me = async (tok) => (await req('GET', '/api/auth/me', { token: tok })).json.usuario;
const ids = {
  discente: (await me(t.discente)).id,
  gestor: (await me(t.gestor)).id,
};
const projetosDocente = (await req('GET', '/api/inscricoes/minhas', { token: t.docente })).json.data;
ids.divulgado = projetosDocente.find((p) => p.status === 'DIVULGADA').id;
ids.aprovado = projetosDocente.find((p) => p.status === 'APROVADA').id;
ids.emAvaliacao = (await req('GET', '/api/inscricoes/minhas', { token: t.docente2 })).json.data[0].id;
ids.candidaturaBruno = (await req('GET', '/api/candidaturas/minhas', { token: t.bruno })).json.data[0].id;
// Gera os avisos de relatório (o bolsista do seed está em atraso) para haver notificação a testar.
await req('GET', '/api/cron/lembretes-relatorio', { headers: { authorization: `Bearer ${SEGREDO_CRON}` } });
ids.notificacaoDiscente = (await req('GET', '/api/notificacoes', { token: t.discente })).json.data[0]?.id;
ids.avaliacaoDoAvaliador = (await req('GET', '/api/avaliacoes/minhas', { token: t.avaliador })).json.data[0].id;

console.log(`\nTeste de segurança em ${base}\n`);

// ── A. Autenticação ──────────────────────────────────────────────────────────
console.log('A. Autenticação');
const protegidas = [
  ['GET', '/api/auth/me'],
  ['GET', '/api/usuarios'],
  ['GET', '/api/usuarios/docentes'],
  ['GET', '/api/editais'],
  ['GET', '/api/inscricoes/minhas'],
  ['GET', `/api/inscricoes/${ids.aprovado}`],
  ['GET', '/api/candidaturas/minhas'],
  ['GET', '/api/notificacoes'],
  ['GET', '/api/avaliacoes/minhas'],
  ['GET', '/api/triagem'],
  ['GET', '/api/dashboard/gestor'],
  ['GET', '/api/auditoria'],
  ['GET', '/api/projetos'],
  ['GET', '/api/projetos/exportacao.csv'],
  ['GET', '/api/perfil/curriculo'],
  ['POST', '/api/editais'],
  ['PATCH', `/api/usuarios/${ids.discente}`],
];
const semToken = await Promise.all(protegidas.map(([m, p]) => req(m, p)));
const vazaram = protegidas.filter((_, i) => semToken[i].status !== 401).map(([m, p], i) => `${m} ${p}=${semToken[i].status}`);
registrar('A', 'A1', `${protegidas.length} rotas protegidas sem token`, 'todas 401', vazaram.length ? vazaram.join(', ') : 'todas 401', !vazaram.length);

registrar('A', 'A2', 'Token malformado', 401, st(await req('GET', '/api/auth/me', { token: 'abc.def' })), st(await req('GET', '/api/auth/me', { token: 'abc.def' })) === 401);

const agora = Math.floor(Date.now() / 1000);
const payloadGestor = { sub: ids.gestor, role: 'GESTOR', nome: 'x', email: 'gestor.demo@unicap.br', emitidoEm: Date.now(), iat: agora, exp: agora + 3600 };
let r = await req('GET', '/api/usuarios', { token: jwt(payloadGestor, '', 'none') });
registrar('A', 'A3', 'JWT com alg "none" se passando pelo gestor', 401, r.status, r.status === 401, 'crítica');

r = await req('GET', '/api/usuarios', { token: jwt(payloadGestor, 'segredo-chutado') });
registrar('A', 'A4', 'JWT de gestor assinado com segredo errado', 401, r.status, r.status === 401, 'crítica');

r = await req('GET', '/api/auth/me', { token: jwt({ ...payloadGestor, iat: agora - 7200, exp: agora - 3600 }, SEGREDO_JWT) });
registrar('A', 'A5', 'JWT expirado (assinatura válida)', 401, r.status, r.status === 401);

r = await req('GET', '/api/usuarios', { token: jwt({ ...payloadGestor, sub: ids.discente, email: 'discente.demo@unicap.br' }, SEGREDO_JWT) });
registrar('A', 'A6', 'JWT válido de aluno com papel GESTOR no token (papel vem do banco)', 403, r.status, r.status === 403, 'crítica');

r = await req('GET', '/api/auth/me', { token: jwt({ ...payloadGestor, sub: randomUUID() }, SEGREDO_JWT) });
registrar('A', 'A7', 'JWT válido de usuário inexistente', 401, r.status, r.status === 401);

// Conta nova (também usada nos grupos C e E): nome com HTML para checar XSS armazenado.
const emailNovo = `seg.${Date.now()}@unicap.br`;
const nomeXss = '<img src=x onerror=alert(1)> Teste Seguranca';
r = await req('POST', '/api/auth/register', { body: { nome: nomeXss, email: emailNovo, senha: 'SenhaForte123', role: 'USUARIO' } });
const cadastroOk = r.status === 201;
r = await req('POST', '/api/auth/login', { body: { email: emailNovo, senha: 'SenhaForte123' } });
registrar('A', 'A8', 'Login de conta com e-mail não confirmado', '403 EMAIL_NAO_CONFIRMADO', `${r.status} ${r.json?.error?.code}`, cadastroOk && r.status === 403);

// ── E. Links enviados por e-mail ─────────────────────────────────────────────
console.log('E. Links enviados por e-mail e enumeração');
const emailConf = await ultimoEmail(emailNovo);
const tokenConf = tokenDoLink(emailConf);
r = await req('POST', '/api/auth/verificar-email', { body: { token: tokenConf } });
const tokNovo = r.json?.token;
const r2 = await req('POST', '/api/auth/verificar-email', { body: { token: tokenConf } });
registrar('E', 'E1', 'Link de confirmação usado duas vezes', '1º 200, 2º 400', `${r.status}, ${r2.status}`, r.status === 200 && r2.status === 400);

registrar(
  'E',
  'E2',
  'Nome com HTML escapado no e-mail enviado',
  'sem <img no HTML',
  emailConf?.html?.includes('<img') ? 'HTML cru no e-mail' : 'escapado',
  !emailConf?.html?.includes('<img'),
  'média',
);

r = await req('POST', '/api/auth/senha', { token: tokNovo, body: { senhaAtual: 'SenhaForte123', novaSenha: 'OutraSenha456' } });
const r3 = await req('GET', '/api/auth/me', { token: tokNovo });
registrar('A', 'A9', 'Troca de senha derruba a sessão antiga', 'antiga 401', `troca ${r.status}, antiga ${r3.status}`, r.status === 200 && r3.status === 401);

const [esqExiste, esqNaoExiste] = await Promise.all([
  req('POST', '/api/auth/esqueci-senha', { body: { email: emailNovo } }),
  req('POST', '/api/auth/esqueci-senha', { body: { email: `ninguem.${Date.now()}@unicap.br` } }),
]);
registrar(
  'E',
  'E3',
  '"Esqueci minha senha" não revela se o e-mail tem conta',
  'respostas iguais',
  esqExiste.status === esqNaoExiste.status && esqExiste.texto === esqNaoExiste.texto ? 'iguais' : 'diferentes',
  esqExiste.status === esqNaoExiste.status && esqExiste.texto === esqNaoExiste.texto,
  'média',
);

const tokenReset = tokenDoLink(await ultimoEmail(emailNovo));
const adulterado = tokenReset.slice(0, -4) + (tokenReset.endsWith('AAAA') ? 'BBBB' : 'AAAA');
r = await req('POST', '/api/auth/redefinir-senha', { body: { token: adulterado, novaSenha: 'Invasor789' } });
registrar('E', 'E4', 'Token de nova senha adulterado', 400, r.status, r.status === 400);
r = await req('POST', '/api/auth/redefinir-senha', { body: { token: tokenReset, novaSenha: 'Legitima789' } });
const reuso = await req('POST', '/api/auth/redefinir-senha', { body: { token: tokenReset, novaSenha: 'Invasor789' } });
registrar('E', 'E5', 'Token de nova senha usado duas vezes', '1º 200, 2º 400', `${r.status}, ${reuso.status}`, r.status === 200 && reuso.status === 400);

const [loginSenhaErrada, loginSemConta] = await Promise.all([
  req('POST', '/api/auth/login', { body: { email: emailNovo, senha: 'errada000' } }),
  req('POST', '/api/auth/login', { body: { email: `ninguem.${Date.now()}@unicap.br`, senha: 'errada000' } }),
]);
registrar(
  'E',
  'E6',
  'Login não revela se o e-mail tem conta',
  'mesma resposta',
  loginSenhaErrada.texto === loginSemConta.texto ? 'iguais' : 'diferentes',
  loginSenhaErrada.status === loginSemConta.status && loginSenhaErrada.texto === loginSemConta.texto,
  'média',
);

r = await req('POST', '/api/auth/register', { body: { nome: 'Outro Nome', email: CONTAS.discente.email, senha: 'SenhaForte123', role: 'DISCENTE', matricula: '1' } });
registrar(
  'E',
  'E7',
  'Cadastro com e-mail já usado revela que a conta existe',
  'não revelar (ou risco aceito)',
  `${r.status} "${r.json?.error?.message}"`,
  r.status !== 409,
  'baixa (risco aceito)',
);

// ── B. Autorização ───────────────────────────────────────────────────────────
console.log('B. Autorização (papéis e recursos de outras pessoas)');
const deGestor = [
  ['GET', '/api/usuarios'],
  ['GET', '/api/dashboard/gestor'],
  ['GET', '/api/auditoria'],
  ['GET', '/api/projetos/exportacao.csv'],
  ['GET', '/api/editais'],
  ['POST', '/api/editais', {}],
  ['GET', '/api/triagem'],
];
for (const [papel, cod] of [['discente', 'B1'], ['docente', 'B2'], ['visitante', 'B3']]) {
  const rs = await Promise.all(deGestor.map(([m, p, b]) => req(m, p, { token: t[papel], body: b })));
  const abertas = deGestor.filter((_, i) => rs[i].status !== 403).map(([m, p], i) => `${m} ${p}=${rs[i].status}`);
  registrar('B', cod, `${papel} em ${deGestor.length} rotas de gestor`, 'todas 403', abertas.length ? abertas.join(', ') : 'todas 403', !abertas.length, 'crítica');
}

r = await req('PATCH', `/api/usuarios/${ids.discente}`, { token: t.discente, body: { role: 'GESTOR' } });
registrar('B', 'B4', 'Aluno tenta se promover a gestor', 403, r.status, r.status === 403, 'crítica');

r = await req('GET', `/api/inscricoes/${ids.emAvaliacao}`, { token: t.bruno });
registrar('B', 'B5', 'Aluno lê projeto em avaliação de um professor', 404, r.status, r.status === 404);
// Todos os professores do seed avaliam algum projeto: cria um professor que não avalia nada.
const emailProf = `prof.${Date.now()}@unicap.br`;
await req('POST', '/api/auth/register', { body: { nome: 'Professor Sem Vinculo', email: emailProf, senha: 'SenhaForte123', role: 'DOCENTE', departamento: 'DCC' } });
const tokProf = (await req('POST', '/api/auth/verificar-email', { body: { token: tokenDoLink(await ultimoEmail(emailProf)) } })).json?.token;
r = await req('GET', `/api/inscricoes/${ids.emAvaliacao}`, { token: tokProf });
registrar('B', 'B6', 'Professor sem vínculo lê projeto em avaliação de colega', 404, r.status, r.status === 404);
r = await req('GET', `/api/inscricoes/${ids.emAvaliacao}`, { token: t.avaliador });
registrar('B', 'B7', 'Controle: avaliador indicado lê o projeto que avalia', 200, r.status, r.status === 200, 'média');

r = await req('PATCH', `/api/inscricoes/${ids.divulgado}`, { token: t.docente2, body: { titulo: 'Invadido' } });
registrar('B', 'B8', 'Professor edita projeto de colega', '403/404', r.status, [403, 404].includes(r.status));

r = await req('DELETE', `/api/candidaturas/${ids.candidaturaBruno}`, { token: t.julia });
registrar('B', 'B9', 'Aluna cancela a candidatura de outro aluno', '403/404', r.status, [403, 404].includes(r.status));

if (ids.notificacaoDiscente) {
  r = await req('PATCH', `/api/notificacoes/${ids.notificacaoDiscente}/leitura`, { token: t.bruno });
  registrar('B', 'B10', 'Aluno marca como lida a notificação de outro', '403/404', r.status, [403, 404].includes(r.status), 'média');
}

r = await req('GET', `/api/avaliacoes/${ids.avaliacaoDoAvaliador}`, { token: t.avaliador2 });
registrar('B', 'B11', 'Professor lê o parecer de outro avaliador', '403/404', r.status, [403, 404].includes(r.status));

r = await req('GET', `/api/projetos/${ids.aprovado}`, { token: t.bruno });
registrar('B', 'B12', 'Aluno lê o projeto (e relatórios) de outro bolsista', '403/404', r.status, [403, 404].includes(r.status));

r = await req('GET', `/api/inscricoes/${ids.divulgado}/candidaturas/${ids.candidaturaBruno}/curriculo`, { token: t.julia });
registrar('B', 'B13', 'Aluna baixa o currículo de outro candidato', '403/404', r.status, [403, 404].includes(r.status));

r = await req('GET', `/api/inscricoes/${ids.divulgado}/candidaturas`, { token: t.docente2 });
registrar('B', 'B14', 'Professor lista candidatos do projeto de colega', '403/404', r.status, [403, 404].includes(r.status));

// ── C. Validação de entrada ──────────────────────────────────────────────────
console.log('C. Validação de entrada');
r = await req('POST', '/api/auth/register', { body: { nome: 'Fulano', email: `g.${Date.now()}@unicap.br`, senha: 'SenhaForte123', role: 'GESTOR' } });
registrar('C', 'C1', 'Cadastro pedindo papel GESTOR', 400, r.status, r.status === 400, 'crítica');
r = await req('POST', '/api/auth/register', { body: { nome: 'Fulano', email: `m.${Date.now()}@unicap.br`, senha: 'SenhaForte123', role: 'USUARIO', emailPendente: false } });
registrar('C', 'C2', 'Cadastro com campo extra (emailPendente:false)', 400, r.status, r.status === 400, 'crítica');
const dominios = ['fulano@gmail.com', 'fulano@unicap.br.evil.com', 'fulano@evilunicap.br'];
const rd = await Promise.all(dominios.map((e) => req('POST', '/api/auth/register', { body: { nome: 'Fulano', email: e, senha: 'SenhaForte123', role: 'USUARIO' } })));
registrar('C', 'C3', `Cadastro com domínio de fora (${dominios.length} variações)`, 'todas 400', rd.map(st).join(','), rd.every((x) => x.status === 400));

const consultas = ['/api/publico/projetos?q[$gt]=', '/api/publico/pesquisas?editalId[$ne]=x&ano=1e400', '/api/usuarios?role[$ne]=DISCENTE'];
const rq = await Promise.all(consultas.map((p) => req('GET', p, { token: t.gestor })));
registrar('C', 'C4', 'Operadores e objetos na query string', 'nenhum 500', rq.map(st).join(','), rq.every((x) => x.status < 500));

r = await req('POST', '/api/auth/login', { raw: '{"email": "x@unicap.br", "senha": ', headers: { 'Content-Type': 'application/json' } });
registrar('C', 'C5', 'JSON malformado', '400 sem stack', `${r.status}${/at .*\.js/.test(r.texto) ? ' COM STACK' : ''}`, r.status === 400 && !/at .*\.js/.test(r.texto), 'média');

r = await req('GET', '/api/nao-existe');
registrar('C', 'C6', 'Rota inexistente da API', '404 JSON', `${r.status} ${r.json ? 'JSON' : 'HTML'}`, r.status === 404 && Boolean(r.json), 'baixa');

r = await req('POST', '/api/auth/login', { body: { email: 'x@unicap.br', senha: 'a'.repeat(2 * 1024 * 1024) } });
registrar('C', 'C7', 'Corpo JSON de 2 MB', 413, `${r.status} "${r.json?.error?.message}"`, r.status === 413, 'média');
registrar(
  'C',
  'C8',
  'Mensagem do 413 adequada a corpo JSON',
  'sem citar "Arquivo"',
  r.json?.error?.message,
  !/arquivo/i.test(r.json?.error?.message ?? ''),
  'baixa',
);

r = await req('POST', '/api/auth/register', { body: { nome: 'Fulano', email: `curto.${Date.now()}@unicap.br`, senha: '12345678', role: 'USUARIO' } });
registrar('C', 'C9', 'Senha fraca (só números)', 400, r.status, r.status === 400, 'média');

// ── D. Arquivos ──────────────────────────────────────────────────────────────
console.log('D. Arquivos (currículo do aluno)');
const envio = (await req('POST', '/api/perfil/curriculo/envio', { token: t.discente })).json;
const urlEnvio = envio.upload.url;
await fetch(`${base}${urlEnvio}`, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: Buffer.from('MZ isto é um executável disfarçado de PDF') });
r = await req('PUT', '/api/perfil/curriculo', { token: t.discente, body: { chave: envio.chave, nome: 'curriculo.pdf' } });
registrar('D', 'D1', 'Arquivo que não é PDF com Content-Type de PDF', 400, `${r.status} "${r.json?.error?.message}"`, r.status === 400);

const envio2 = (await req('POST', '/api/perfil/curriculo/envio', { token: t.discente })).json;
const urlAdulterada = envio2.upload.url.replace(/sig=([^&]+)/, (_, s) => `sig=${s.slice(0, -2)}xx`);
r = await req('PUT', urlAdulterada, { raw: Buffer.from('%PDF-1.4 teste'), headers: { 'Content-Type': 'application/pdf' } });
registrar('D', 'D2', 'Envio com assinatura do link adulterada', 403, r.status, r.status === 403);

const travessias = ['/api/arquivos/envio/..%2F..%2Fpackage.json?exp=9999999999999&sig=x', '/api/arquivos/..%2F..%2F.env?exp=9999999999999&nome=a&sig=x'];
const rt = await Promise.all(
  travessias.map((p) =>
    p.includes('envio')
      ? req('PUT', p, { raw: Buffer.from('%PDF-'), headers: { 'Content-Type': 'application/pdf' } })
      : req('GET', p),
  ),
);
registrar('D', 'D3', 'Path traversal na chave do arquivo', '400/404', rt.map(st).join(','), rt.every((x) => [400, 404].includes(x.status)), 'crítica');

const envioJulia = (await req('POST', '/api/perfil/curriculo/envio', { token: t.julia })).json;
await fetch(`${base}${envioJulia.upload.url}`, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: Buffer.from('%PDF-1.4 arquivo da julia') });
r = await req('PUT', '/api/perfil/curriculo', { token: t.discente, body: { chave: envioJulia.chave, nome: 'roubado.pdf' } });
registrar('D', 'D4', 'Aluno registra como seu um arquivo enviado por outra aluna', 400, r.status, r.status === 400);

r = await req('GET', '/api/perfil/curriculo', { token: t.bruno });
const urlLeitura = r.json?.url;
if (urlLeitura) {
  const trocado = urlLeitura.replace(/nome=[^&]+/, 'nome=outro.pdf');
  const rl = await req('GET', trocado);
  registrar('D', 'D5', 'Link de leitura com o nome do arquivo trocado', 403, rl.status, rl.status === 403);
}

// ── F. Configuração ──────────────────────────────────────────────────────────
console.log('F. Configuração');
r = await req('GET', '/api/publico/editais', { headers: { Origin: 'https://site-malicioso.example' } });
const h = r.headers;
const faltando = [
  ['content-security-policy', /frame-ancestors 'none'/],
  ['x-frame-options', /DENY/],
  ['x-content-type-options', /nosniff/],
  ['referrer-policy', /strict-origin/],
  ['cross-origin-opener-policy', /same-origin/],
].filter(([n, re]) => !re.test(h.get(n) ?? '')).map(([n]) => n);
registrar('F', 'F1', 'Cabeçalhos de segurança da API', 'todos presentes', faltando.length ? `faltando: ${faltando.join(', ')}` : 'todos presentes', !faltando.length, 'média');
registrar('F', 'F2', 'X-Powered-By (revela Express)', 'ausente', h.get('x-powered-by') ?? 'ausente', !h.get('x-powered-by'), 'baixa');
registrar('F', 'F3', 'CORS para origem maliciosa', 'sem Access-Control-Allow-Origin', h.get('access-control-allow-origin') ?? 'ausente', !h.get('access-control-allow-origin'));

const [cronSem, cronErrado, cronCerto] = await Promise.all([
  req('GET', '/api/cron/encerrar-editais'),
  req('GET', '/api/cron/encerrar-editais', { headers: { authorization: 'Bearer chute' } }),
  req('GET', '/api/cron/encerrar-editais', { headers: { authorization: `Bearer ${SEGREDO_CRON}` } }),
]);
registrar('F', 'F4', 'Tarefas agendadas sem / com segredo errado / certo', '401, 401, 200', `${cronSem.status}, ${cronErrado.status}, ${cronCerto.status}`, cronSem.status === 401 && cronErrado.status === 401 && cronCerto.status === 200);

// ── G. Força bruta (por último: bloqueia o IP por 15 min) ─────────────────────
console.log('G. Força bruta');
const vitima = 'julia.demo@unicap.br';
const rajada = await Promise.all(
  Array.from({ length: 30 }, (_, i) => req('POST', '/api/auth/login', { body: { email: vitima, senha: `chute${i}xyz` } })),
);
const processadas = rajada.filter((x) => x.status === 401).length;
registrar('G', 'G1', '30 senhas erradas em paralelo para uma conta (limite: 10)', 'no máximo 10 testadas', `${processadas} testadas, ${rajada.filter((x) => x.status === 429).length} bloqueadas`, processadas <= 10, 'alta');

// Depois de 10 senhas erradas de fato testadas, nem a senha certa entra até a janela acabar.
// (Uma rajada recusada inteira não testa senha nenhuma e, por isso, não tranca a conta.)
const seguidas = [];
for (let i = 0; i < 12; i++) seguidas.push((await req('POST', '/api/auth/login', { body: { email: vitima, senha: `seq${i}xyz` } })).status);
r = await req('POST', '/api/auth/login', { body: { email: vitima, senha: 'discente123' } });
const testadasNoTotal = processadas + seguidas.filter((s) => s === 401).length;
registrar(
  'G',
  'G2',
  'Após 10 senhas erradas, a conta atacada fica bloqueada (mesmo com a senha certa)',
  '429, com no máximo 10 testadas',
  `${r.status}, ${testadasNoTotal} testadas no total`,
  r.status === 429 && testadasNoTotal <= 10,
  'alta',
);

r = await req('POST', '/api/auth/login', { body: CONTAS.visitante });
registrar('G', 'G3', 'Outra pessoa na mesma rede (IP) consegue entrar com a senha certa', 200, r.status, r.status === 200, 'alta');

const esq = [];
for (let i = 0; i < 4; i++) esq.push((await req('POST', '/api/auth/esqueci-senha', { body: { email: CONTAS.docente.email } })).status);
registrar('G', 'G4', 'Rajada de "esqueci minha senha" para um mesmo e-mail', 'bloqueia', esq.join(','), esq.includes(429), 'média');

// ── Relatório ────────────────────────────────────────────────────────────────
const falhas = resultados.filter((x) => !x.ok);
console.log(`\n${resultados.length - falhas.length}/${resultados.length} verificações passaram.`);
for (const f of falhas) console.log(`  FALHOU ${f.id} [${f.severidade}] ${f.descricao}: esperado ${f.esperado}, obtido ${f.obtido}`);
salvar('seguranca-local.json', resultados);
const md = tabela(resultados, [
  { titulo: 'Id', valor: (l) => l.id },
  { titulo: 'Verificação', valor: (l) => l.descricao },
  { titulo: 'Esperado', valor: (l) => l.esperado },
  { titulo: 'Obtido', valor: (l) => l.obtido.replace(/\|/g, '/') },
  { titulo: 'Resultado', valor: (l) => (l.ok ? '✅' : `❌ ${l.severidade}`) },
]);
console.log(`Resultados salvos em ${salvar('seguranca-local.md', md + '\n')}`);
