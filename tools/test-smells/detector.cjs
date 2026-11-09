/*
 * Detector de test smells para Jest / Vitest / Playwright (TypeScript).
 * Aplica o catalogo do tsDetect (testsmells.org), adaptado de JUnit para JS/TS.
 *
 * O tsDetect original (github.com/TestSmells/TestSmellDetector) so le testes JUnit/Java;
 * este script reproduz as mesmas regras sobre a AST do compilador TypeScript.
 *
 * Uso, a partir da raiz do repositorio (precisa do server/ instalado, por causa do typescript):
 *   node tools/test-smells/detector.cjs [input.csv] [pasta-de-saida]
 *
 *   input.csv: appName,pathToTestFile[,pathToProductionFile]   (mesmo formato do tsDetect;
 *              caminhos relativos a pasta atual)
 *   Saida: Output_TestSmellDetection.csv (mesmas colunas do tsDetect) e detalhes.json (por teste).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const inputCsv = process.argv[2] || path.join(__dirname, 'input.csv');
const outDir = process.argv[3] || path.join(__dirname, 'resultado');
const ts = require(path.resolve('server/node_modules/typescript'));

const SMELLS = [
  'Assertion Roulette',
  'Conditional Test Logic',
  'Constructor Initialization',
  'Default Test',
  'Dependent Test',
  'Duplicate Assert',
  'Eager Test',
  'Empty Test',
  'Exception Handling',
  'General Fixture',
  'Ignored Test',
  'Lazy Test',
  'Magic Number Test',
  'Mystery Guest',
  'Redundant Print',
  'Redundant Assertion',
  'Resource Optimism',
  'Sensitive Equality',
  'Sleepy Test',
  'Unknown Test',
];

const TEST_FNS = new Set(['it', 'test', 'xit', 'xtest', 'fit']);
const SUITE_FNS = new Set(['describe', 'xdescribe', 'fdescribe']);
const HOOKS = new Set(['beforeEach', 'beforeAll', 'afterEach', 'afterAll']);
const SETUP_HOOKS = new Set(['beforeEach', 'beforeAll']);
const LIB_MODULES = /^(supertest|@playwright\/test|vitest|@jest\/globals|node:|fs|path|crypto)/;
const HELPER_MODULES = /(\/helpers\/|\.\/support|\/testing\/)/;
const HTTP_VERBS = new Set(['get', 'post', 'put', 'patch', 'delete']);

/** Decompoe a chamada: it.skip(...) -> { base: 'it', mods: ['skip'] }; it.each(t)(...) tambem. */
function calleeInfo(expr) {
  let e = expr;
  const mods = [];
  // it.each(table)(name, fn)
  if (ts.isCallExpression(e)) {
    const inner = calleeInfo(e.expression);
    if (inner && inner.mods.includes('each')) return inner;
    return null;
  }
  while (ts.isPropertyAccessExpression(e)) {
    mods.unshift(e.name.text);
    e = e.expression;
  }
  if (ts.isIdentifier(e)) return { base: e.text, mods };
  return null;
}

function classify(call) {
  const info = calleeInfo(call.expression);
  if (!info) return null;
  const { base, mods } = info;
  const ignored = base.startsWith('x') || mods.some((m) => m === 'skip' || m === 'todo' || m === 'fixme');
  // Playwright: test.describe(...), test.beforeEach(...), test.step(...)
  if (base === 'test' && mods[0] === 'describe') return { kind: 'suite', ignored, mods };
  if (base === 'test' && HOOKS.has(mods[0])) return { kind: 'hook', hook: mods[0] };
  if (base === 'test' && ['step', 'use', 'setTimeout', 'slow', 'info', 'extend'].includes(mods[0])) return null;
  if (SUITE_FNS.has(base)) return { kind: 'suite', ignored, mods };
  if (HOOKS.has(base)) return { kind: 'hook', hook: base };
  if (TEST_FNS.has(base) && mods.every((m) => ['only', 'skip', 'todo', 'each', 'concurrent', 'fixme', 'fails'].includes(m)))
    return { kind: 'test', ignored };
  return null;
}

function fnArg(call) {
  return call.arguments.find((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a));
}

function nameArg(call, sf) {
  const a = call.arguments[0];
  if (!a) return '(sem nome)';
  if (ts.isStringLiteralLike(a)) return a.text;
  return a.getText(sf);
}

function walk(node, cb) {
  cb(node);
  ts.forEachChild(node, (c) => walk(c, cb));
}

/** Raiz de uma cadeia de chamadas: expect(x).not.toBe(y) -> a CallExpression expect(x). */
function chainRoot(expr) {
  let e = expr;
  for (;;) {
    if (ts.isCallExpression(e)) {
      if (ts.isIdentifier(e.expression)) return e;
      e = e.expression;
    } else if (ts.isPropertyAccessExpression(e)) e = e.expression;
    else if (ts.isAwaitExpression(e) || ts.isParenthesizedExpression(e)) e = e.expression;
    else return e;
  }
}

function isExpectCall(node) {
  if (!ts.isCallExpression(node)) return false;
  const c = node.expression;
  if (ts.isIdentifier(c) && c.text === 'expect') return true;
  // expect.soft(...), expect.poll(...)
  if (ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.expression) && c.expression.text === 'expect')
    return ['soft', 'poll'].includes(c.name.text);
  if (ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.expression) && c.expression.text === 'assert') return true;
  return false;
}

/** Statements de assercao: o ExpressionStatement cujo topo e uma cadeia que parte de expect(). */
function assertionStatements(body, sf) {
  const out = [];
  walk(body, (n) => {
    if (ts.isExpressionStatement(n)) {
      let e = n.expression;
      if (ts.isAwaitExpression(e)) e = e.expression;
      const root = chainRoot(e);
      if (root && isExpectCall(root)) out.push({ node: n, root, top: e, text: n.getText(sf).replace(/\s+/g, ' ') });
    }
  });
  return out;
}

function analyzeFile(appName, testFile, prodFile, helperAsserters) {
  const src = fs.readFileSync(testFile, 'utf8');
  const sf = ts.createSourceFile(testFile, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const fileResult = { appName, testFile, prodFile: prodFile || '', smells: {}, tests: [], notes: [] };
  for (const s of SMELLS) fileResult.smells[s] = false;
  const flag = (smell, where, detail) => {
    fileResult.smells[smell] = true;
    fileResult.notes.push({ smell, where, detail });
  };

  // ---------- imports de producao ----------
  const prodNames = new Set();
  sf.statements.forEach((st) => {
    if (!ts.isImportDeclaration(st)) return;
    const spec = st.moduleSpecifier.text;
    if (LIB_MODULES.test(spec) || HELPER_MODULES.test(spec)) return;
    const clause = st.importClause;
    if (!clause || clause.isTypeOnly) return;
    if (clause.name) prodNames.add(clause.name.text);
    const nb = clause.namedBindings;
    if (nb && ts.isNamedImports(nb))
      nb.elements.forEach((el) => {
        if (!el.isTypeOnly) prodNames.add(el.name.text);
      });
  });

  // Funcoes locais do arquivo de teste que contem expect() contam como assercao (helper asserter).
  const localAsserters = new Set(helperAsserters);
  walk(sf, (n) => {
    let name = null;
    let body = null;
    if (ts.isFunctionDeclaration(n) && n.name && n.body) [name, body] = [n.name.text, n.body];
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer)))
      [name, body] = [n.name.text, n.initializer.body];
    if (name && body) {
      let has = false;
      walk(body, (m) => {
        if (isExpectCall(m)) has = true;
      });
      if (has) localAsserters.add(name);
    }
  });

  // ---------- Constructor Initialization ----------
  walk(sf, (n) => {
    if (ts.isClassDeclaration(n) && n.members.some((m) => ts.isConstructorDeclaration(m)))
      flag('Constructor Initialization', `classe ${n.name ? n.name.text : '(anonima)'}`, 'classe com construtor no arquivo de teste');
  });

  // ---------- Default Test ----------
  if (/example(unit|instrumented)?test/i.test(path.basename(testFile))) flag('Default Test', path.basename(testFile), 'arquivo de teste padrao gerado por template');

  // ---------- Dependent Test (Playwright serial / estado compartilhado entre testes) ----------
  walk(sf, (n) => {
    if (ts.isCallExpression(n)) {
      const t = n.expression.getText(sf);
      if (t === 'test.describe.serial' || (t === 'test.describe.configure' && /serial/.test(n.getText(sf))))
        flag('Dependent Test', `linha ${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`, `${t}: os testes dependem da ordem de execucao`);
    }
  });

  // ---------- arvore de suites, hooks e testes ----------
  const fixtureVarsByScope = []; // pilha de { vars:Set, hookLine }
  const allTests = [];

  function collectAssignedVars(fnBody) {
    const vars = new Set();
    walk(fnBody, (n) => {
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(n.left)) vars.add(n.left.text);
    });
    return vars;
  }

  function visitScope(nodes, scopeFixtures) {
    // Hooks deste escopo primeiro (valem para todos os testes do escopo, inclusive aninhados)
    const local = new Set(scopeFixtures);
    for (const st of nodes) {
      const call = ts.isExpressionStatement(st) && ts.isCallExpression(st.expression) ? st.expression : null;
      if (!call) continue;
      const c = classify(call);
      if (c && c.kind === 'hook' && SETUP_HOOKS.has(c.hook)) {
        const f = fnArg(call);
        if (f) collectAssignedVars(f.body).forEach((v) => local.add(v));
      }
    }
    for (const st of nodes) {
      const call = ts.isExpressionStatement(st) && ts.isCallExpression(st.expression) ? st.expression : null;
      if (!call) continue;
      const c = classify(call);
      if (!c) continue;
      if (c.kind === 'suite') {
        if (c.ignored) flag('Ignored Test', `describe "${nameArg(call, sf)}"`, 'suite desativada');
        const f = fnArg(call);
        if (f && f.body && ts.isBlock(f.body)) visitScope(f.body.statements, local);
      } else if (c.kind === 'test') {
        allTests.push({ call, ignored: c.ignored, fixtures: local });
      }
    }
  }
  visitScope(sf.statements, new Set());

  // Variaveis de modulo atribuidas dentro de testes (estado compartilhado => Dependent Test)
  const moduleLets = new Set();
  sf.statements.forEach((st) => {
    if (ts.isVariableStatement(st) && st.declarationList.flags & ts.NodeFlags.Let)
      st.declarationList.declarations.forEach((d) => ts.isIdentifier(d.name) && moduleLets.add(d.name.text));
  });

  // Objetos de modulo criados com new (ex.: const fixedClock = new FixedClock(...))
  const moduleSingletons = new Set();
  sf.statements.forEach((st) => {
    if (ts.isVariableStatement(st))
      st.declarationList.declarations.forEach(
        (d) => ts.isIdentifier(d.name) && d.initializer && ts.isNewExpression(d.initializer) && moduleSingletons.add(d.name.text),
      );
  });
  // ...e quais deles sao repostos num beforeEach (o que neutraliza a dependencia)
  const resetHooks = new Set();
  walk(sf, (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'beforeEach') {
      const f = fnArg(n);
      if (f)
        walk(f.body, (m) => {
          if (ts.isCallExpression(m) && ts.isPropertyAccessExpression(m.expression) && ts.isIdentifier(m.expression.expression) && moduleSingletons.has(m.expression.expression.text))
            resetHooks.add(m.expression.expression.text);
        });
    }
  });

  const prodCallsByTest = new Map();

  for (const t of allTests) {
    const { call } = t;
    const name = nameArg(call, sf);
    const line = sf.getLineAndCharacterOfPosition(call.getStart()).line + 1;
    const where = `"${name}" (linha ${line})`;
    const f = fnArg(call);
    const tr = { name, line, assertions: 0, smells: [] };
    const mark = (smell, detail) => {
      if (!tr.smells.includes(smell)) tr.smells.push(smell);
      flag(smell, where, detail);
    };

    if (t.ignored) mark('Ignored Test', 'teste desativado (.skip/.todo/x)');
    if (!f) {
      if (!t.ignored) mark('Empty Test', 'teste sem corpo');
      fileResult.tests.push(tr);
      continue;
    }
    const body = f.body;

    // Empty Test
    if (ts.isBlock(body) && body.statements.length === 0) mark('Empty Test', 'corpo vazio');

    // Assercoes
    const asserts = assertionStatements(body, sf);
    let helperAsserts = 0;
    walk(body, (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && localAsserters.has(n.expression.text)) helperAsserts++;
    });
    // matchers encadeados que retornam promessa (await expect(...).rejects) tambem contam
    tr.assertions = asserts.length + helperAsserts;

    if (tr.assertions === 0 && !t.ignored) mark('Unknown Test', 'nenhuma assercao (expect) no teste nem em helpers chamados');

    // Assertion Roulette: varias assercoes sem mensagem explicativa (expect() do Jest nao tem mensagem)
    if (asserts.length >= 2) {
      tr.rouletteCount = asserts.length;
      mark('Assertion Roulette', `${asserts.length} assercoes sem mensagem`);
    }

    // Duplicate Assert
    const seen = new Map();
    asserts.forEach((a) => seen.set(a.text, (seen.get(a.text) || 0) + 1));
    for (const [txt, n] of seen) if (n > 1) mark('Duplicate Assert', `${n}x: ${txt.slice(0, 110)}`);

    // Redundant Assertion: expect(A).toBe(A) com o mesmo texto literal
    asserts.forEach((a) => {
      const exp = a.root;
      const matcher = ts.isCallExpression(a.top) ? a.top : null;
      if (exp.arguments.length === 1 && matcher && matcher.arguments.length === 1) {
        const l = exp.arguments[0].getText(sf);
        const r = matcher.arguments[0].getText(sf);
        if (l === r) mark('Redundant Assertion', a.text.slice(0, 110));
        if (/^(true|false)$/.test(l) && /^(true|false)$/.test(r)) mark('Redundant Assertion', a.text.slice(0, 110));
      }
    });

    // Magic Number Test: literais numericos nos argumentos das assercoes
    const magic = [];
    asserts.forEach((a) => {
      walk(a.node, (n) => {
        if (ts.isNumericLiteral(n)) {
          // ignora indices de array e argumentos de chamadas de producao dentro do expect
          const p = n.parent;
          if (ts.isElementAccessExpression(p)) return;
          magic.push(n.text);
        }
      });
    });
    if (magic.length) {
      const http = magic.filter((m) => /^[1-5]\d\d$/.test(m));
      tr.magic = { total: magic.length, http: http.length };
      mark('Magic Number Test', `literais em assercoes: ${[...new Set(magic)].slice(0, 10).join(', ')}${http.length === magic.length ? ' (so status HTTP)' : ''}`);
    }

    // Sensitive Equality
    asserts.forEach((a) => {
      const t0 = a.root.arguments.map((x) => x.getText(sf)).join(',');
      if (/\.toString\(\)|JSON\.stringify\(|\bString\(/.test(t0)) mark('Sensitive Equality', a.text.slice(0, 110));
    });

    // throw dentro de uma funcao aninhada (stub/fake) nao e tratamento de excecao do teste
    const insideNestedFn = (n) => {
      for (let p = n.parent; p && p !== body; p = p.parent)
        if (ts.isArrowFunction(p) || ts.isFunctionExpression(p) || ts.isMethodDeclaration(p)) return true;
      return false;
    };

    // Dependent Test: o teste altera um objeto de modulo (ex.: relogio fixo) que outro teste le
    walk(body, (n) => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ts.isIdentifier(n.expression.expression)) {
        const obj = n.expression.expression.text;
        if (moduleSingletons.has(obj) && !resetHooks.has(obj) && /^(set|advance|add|push|clear|reset|remove|delete)/.test(n.expression.name.text))
          mark('Dependent Test', `altera objeto compartilhado do modulo sem reposicao em beforeEach: ${obj}.${n.expression.name.text}()`);
      }
    });

    // Varredura geral do corpo
    const condKinds = new Set();
    walk(body, (n) => {
      switch (n.kind) {
        case ts.SyntaxKind.IfStatement: condKinds.add('if'); break;
        case ts.SyntaxKind.SwitchStatement: condKinds.add('switch'); break;
        case ts.SyntaxKind.ConditionalExpression: condKinds.add('ternario'); break;
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.ForInStatement: condKinds.add('for'); break;
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement: condKinds.add('while'); break;
        case ts.SyntaxKind.TryStatement: mark('Exception Handling', 'try/catch no teste'); break;
        case ts.SyntaxKind.ThrowStatement:
          if (!insideNestedFn(n)) mark('Exception Handling', 'throw no teste');
          break;
        default:
      }
      if (ts.isCallExpression(n)) {
        const txt = n.expression.getText(sf);
        if (/^console\.(log|info|warn|error|debug)$/.test(txt) || txt === 'process.stdout.write') mark('Redundant Print', txt);
        // test.setTimeout / jest.setTimeout so configuram o limite do teste, nao esperam
        if (/(^|\.)(setTimeout|sleep|delay|waitForTimeout)$/.test(txt) && !/^(test|jest|vi)\.setTimeout$/.test(txt)) mark('Sleepy Test', txt);
        if (/(^|\.)(readFileSync|readFile|writeFileSync|writeFile|createReadStream|readdirSync)$/.test(txt)) {
          mark('Mystery Guest', `${txt}: depende de arquivo externo`);
        }
        if (/(^|\.)existsSync$/.test(txt)) mark('Resource Optimism', `${txt}`);
        if (txt === 'fetch' || /\.request\.(get|post|put|patch|delete)$/.test(txt)) mark('Mystery Guest', `${txt}: depende de servico HTTP externo`);
      }
      if (ts.isPropertyAccessExpression(n) && n.getText(sf).startsWith('process.env')) mark('Mystery Guest', 'le process.env');
    });
    if (condKinds.size) mark('Conditional Test Logic', [...condKinds].join(', '));

    // Dependent Test: teste atribui variavel de modulo (estado que outro teste pode ler)
    walk(body, (n) => {
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(n.left) && moduleLets.has(n.left.text))
        mark('Dependent Test', `atribui a variavel de modulo "${n.left.text}"`);
    });

    // General Fixture: variavel preparada no beforeEach/beforeAll que este teste nao usa
    if (t.fixtures.size) {
      const used = new Set();
      walk(body, (n) => ts.isIdentifier(n) && used.add(n.text));
      const unused = [...t.fixtures].filter((v) => !used.has(v));
      tr.fixtureUnused = unused;
    }

    // Chamadas de producao (Eager / Lazy)
    const instances = new Map();
    const calls = new Set();
    walk(body, (n) => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && ts.isNewExpression(n.initializer) && ts.isIdentifier(n.initializer.expression) && prodNames.has(n.initializer.expression.text))
        instances.set(n.name.text, n.initializer.expression.text);
    });
    walk(body, (n) => {
      if (!ts.isCallExpression(n)) return;
      const e = n.expression;
      if (ts.isIdentifier(e) && prodNames.has(e.text)) calls.add(e.text);
      if (ts.isPropertyAccessExpression(e)) {
        const obj = e.expression;
        if (ts.isIdentifier(obj) && prodNames.has(obj.text)) calls.add(`${obj.text}.${e.name.text}`);
        if (ts.isIdentifier(obj) && instances.has(obj.text)) calls.add(`${instances.get(obj.text)}.${e.name.text}`);
        // supertest: request(app).post('/api/x')
        if (HTTP_VERBS.has(e.name.text) && ts.isCallExpression(obj) && ts.isIdentifier(obj.expression) && obj.expression.text === 'request' && n.arguments[0]) {
          let route = n.arguments[0].getText(sf).replace(/^[`'"]|[`'"]$/g, '').replace(/\$\{[^}]+\}/g, ':id').replace(/\?.*$/, '');
          calls.add(`${e.name.text.toUpperCase()} ${route}`);
        }
      }
    });
    tr.prodCalls = [...calls];
    prodCallsByTest.set(tr, calls);
    if (calls.size > 1) mark('Eager Test', `${calls.size} metodos/endpoints de producao: ${[...calls].slice(0, 6).join('; ')}${calls.size > 6 ? '; ...' : ''}`);

    fileResult.tests.push(tr);
  }

  // General Fixture (nivel de arquivo, como no tsDetect): algum teste nao usa parte do fixture
  const gf = fileResult.tests.filter((t) => t.fixtureUnused && t.fixtureUnused.length);
  if (gf.length) {
    const vars = new Set(gf.flatMap((t) => t.fixtureUnused));
    flag('General Fixture', `${gf.length} de ${fileResult.tests.length} testes`, `variaveis do beforeEach nao usadas por todos: ${[...vars].join(', ')}`);
    gf.forEach((t) => t.smells.push('General Fixture'));
  }

  // Lazy Test: o mesmo metodo de producao chamado por varios testes
  const byCall = new Map();
  for (const [tr, calls] of prodCallsByTest) for (const c of calls) byCall.set(c, [...(byCall.get(c) || []), tr]);
  for (const [c, trs] of byCall)
    if (trs.length > 1 && !/^(GET|POST|PUT|PATCH|DELETE) /.test(c)) {
      flag('Lazy Test', c, `${trs.length} testes chamam o mesmo metodo`);
      trs.forEach((t) => !t.smells.includes('Lazy Test') && t.smells.push('Lazy Test'));
    }

  return fileResult;
}

// Helpers externos que fazem assercao (ex.: entrar() em support.ts tem expect())
function helperAssertersFor(testFile) {
  const out = new Set();
  const dir = path.dirname(testFile);
  const src = fs.readFileSync(testFile, 'utf8');
  const sf = ts.createSourceFile(testFile, src, ts.ScriptTarget.Latest, true);
  sf.statements.forEach((st) => {
    if (!ts.isImportDeclaration(st)) return;
    const spec = st.moduleSpecifier.text;
    if (!spec.startsWith('.')) return;
    const cand = [spec + '.ts', spec + '.tsx', spec + '/index.ts'].map((s) => path.resolve(dir, s)).find((p) => fs.existsSync(p));
    if (!cand) return;
    const hs = ts.createSourceFile(cand, fs.readFileSync(cand, 'utf8'), ts.ScriptTarget.Latest, true);
    hs.statements.forEach((h) => {
      if (ts.isFunctionDeclaration(h) && h.name && h.body) {
        let has = false;
        walk(h.body, (m) => isExpectCall(m) && (has = true));
        if (has) out.add(h.name.text);
      }
    });
  });
  return out;
}

const rows = fs
  .readFileSync(inputCsv, 'utf8')
  .split(/\r?\n/)
  .filter((l) => l.trim())
  .map((l) => l.split(','));

const results = rows.map(([app, testFile, prod]) => analyzeFile(app, testFile, prod, helperAssertersFor(testFile)));

const header = ['App', 'TestFilePath', 'ProductionFilePath', 'NumberOfTests', 'NumberOfAssertions', ...SMELLS];
const csv = [header.join(',')];
for (const r of results) {
  const nA = r.tests.reduce((s, t) => s + t.assertions, 0);
  csv.push([r.appName, r.testFile, r.prodFile, r.tests.length, nA, ...SMELLS.map((s) => r.smells[s])].join(','));
}
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'Output_TestSmellDetection.csv'), csv.join('\n') + '\n');
fs.writeFileSync(path.join(outDir, 'detalhes.json'), JSON.stringify(results, null, 2));

// Resumo no terminal
const total = results.reduce((s, r) => s + r.tests.length, 0);
console.log(`Arquivos: ${results.length} | testes: ${total}`);
for (const s of SMELLS) {
  const files = results.filter((r) => r.smells[s]).length;
  const tests = results.reduce((acc, r) => acc + r.tests.filter((t) => t.smells.includes(s)).length, 0);
  console.log(`${s.padEnd(27)} arquivos=${String(files).padStart(2)}  testes=${tests}`);
}
