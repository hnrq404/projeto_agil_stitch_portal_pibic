# Smell Test e Limpeza de Código

> Página da wiki conectada a [[Revisao-e-Otimizacoes]], [[Arquitetura]] e [[Sprints]].
> Análise feita em 09/11/2026 sobre a `main` (commit `feb3a71`).
> Escopo: `server/` e `web/` (aplicação principal). O `portal-lab/` (protótipo Convex) entrou só na medição de smells, sem alterações.

---

## 1. Resumo

| Verificação | Ferramenta | Resultado |
|---|---|---|
| Código morto (exports, arquivos, dependências) | `knip` 5 + checagem manual de cada achado | 14 declarações sem nenhum uso removidas do `server/` (35 linhas). O `web/` não tinha código morto de fato. |
| Variáveis e parâmetros não usados | `tsc` com `noUnusedLocals` e `noUnusedParameters`, inclusive nos testes | Nenhum achado. |
| Test smells | Catálogo do tsDetect aplicado a Jest/Vitest/Playwright (`tools/test-smells/`) | 24 arquivos e 228 testes analisados. Dependências entre testes zeradas, lógica condicional de 20 para 12 testes. |
| Regressão | typecheck, ESLint, Jest (unit + integration) | Tudo verde: 173 testes (eram 162; os `it.each` separaram casos que estavam em laços). |

---

## 2. Por que não rodamos o `TestSmellDetector.jar` direto

O tsDetect ([TestSmells/TestSmellDetector](https://github.com/TestSmells/TestSmellDetector/releases)) usa o JavaParser e só entende testes **JUnit em Java**. Os testes deste projeto são **TypeScript** (Jest no `server/`, Vitest e Playwright no `web/`), então o jar não teria o que analisar.

A saída foi reproduzir as mesmas regras sobre a AST do compilador TypeScript, em `tools/test-smells/detector.cjs`. A entrada e a saída seguem o formato do tsDetect:

- **Entrada:** `tools/test-smells/input.csv`, no formato `app,arquivoDeTeste,arquivoDeProducao`.
- **Saída:** `Output_TestSmellDetection.csv`, com as mesmas colunas do tsDetect (um `true`/`false` por smell e por arquivo), e `detalhes.json`, com o detalhe por teste.

```bash
# na raiz do repositório (precisa do server/ instalado)
node tools/test-smells/detector.cjs
# resultado em tools/test-smells/resultado/ (ignorado pelo git)
```

### Adaptações de JUnit para JS/TS

| Smell | Como foi detectado aqui |
|---|---|
| Assertion Roulette | 2 ou mais `expect()` no teste (o `expect` do Jest não aceita mensagem, então toda asserção múltipla conta) |
| Conditional Test Logic | `if`, `switch`, ternário ou laço no corpo do teste |
| Dependent Test | o teste atribui uma variável do módulo, ou altera um objeto compartilhado (ex.: relógio fixo) que não é reposto em `beforeEach`; `test.describe.serial` |
| Duplicate Assert | a mesma linha de `expect` repetida no teste |
| Eager Test | o teste chama mais de uma função de produção (ou mais de um endpoint HTTP) |
| Exception Handling | `try/catch` ou `throw` no corpo do teste (não conta `throw` dentro de stubs) |
| General Fixture | variável preparada no `beforeEach` que algum teste do escopo não usa |
| Lazy Test | a mesma função de produção chamada por vários testes |
| Magic Number Test | literal numérico dentro de uma asserção |
| Mystery Guest | leitura de arquivo, `process.env` ou chamada HTTP externa |
| Sensitive Equality | `toString()`, `String()` ou `JSON.stringify()` dentro do `expect` |
| Sleepy Test | `setTimeout`, `sleep`, `waitForTimeout` (não conta `jest.setTimeout`/`test.setTimeout`, que só configuram o limite) |
| Unknown Test | teste sem nenhuma asserção, nem em helpers chamados |
| Constructor Initialization, Default Test, Empty Test, Ignored Test, Redundant Print, Redundant Assertion, Resource Optimism | mesma definição do tsDetect |

A contagem de testes do detector bate com a do Jest (162 em unit + integration no HEAD), e os achados de cada smell com peso real foram conferidos à mão.

---

## 3. Resultado do Smell Test

Número de testes afetados, antes e depois das correções (24 arquivos, 228 testes; `it.each` conta como um teste na análise estática):

| Smell | Antes | Depois | Leitura |
|---|---:|---:|---|
| Dependent Test | 5 | **0** | Corrigido (ver 3.1). |
| Conditional Test Logic | 20 | **12** | Os laços que sobraram repetem uma ação para montar estado (ex.: 10 logins errados para disparar o rate limit), o que é aceitável. |
| Exception Handling | 4 | **1** | Sobrou só o `try/catch` do `portal-lab`. |
| Duplicate Assert | 3 | **2** | Os dois restantes repetem a asserção depois de mudar o estado, o que é intencional. |
| Assertion Roulette | 129 | 127 | Mediana de 3 asserções. Os 7 testes com 10 ou mais são jornadas E2E/integração, onde é esperado. |
| General Fixture | 23 | 24 → **6** | Era concentrado em `jornada.int.test.ts`. O +1 da primeira rodada é o teste de auditoria, que passou a usar um container próprio (troca proposital). Depois da T1 (ver 4) caiu para 6. |
| Magic Number Test | 147 | 146 | 400 literais, dos quais 157 são status HTTP (`toBe(201)`), que se explicam sozinhos. |
| Eager Test | 49 | 49 | Integrações e jornadas chamam vários endpoints por natureza. |
| Lazy Test | 105 | 105 | Padrão normal de testes de regra (um comportamento por teste da mesma função). |
| Mystery Guest | 5 | 5 | Leitura do `vercel.json` (garante a mesma CSP no Express e na Vercel) e `process.env` nos testes de cron. Todos intencionais. |
| Sensitive Equality | 4 | 4 | `JSON.stringify(body)` para garantir que dados sensíveis (senhaHash, e-mail, matrícula) não vazam. Uso legítimo. |
| Sleepy, Empty, Ignored, Unknown, Redundant Print/Assertion, Resource Optimism, Constructor Initialization, Default Test | 0 | 0 | Nenhuma ocorrência. |

### 3.1 Correções aplicadas nos testes

| Arquivo | Smell | O que mudou |
|---|---|---|
| `server/tests/unit/editais.rules.test.ts` | Dependent Test, Duplicate Assert | O `fixedClock` é compartilhado pelo arquivo. Os testes o adiantavam e "desfaziam" no fim do próprio corpo. Se uma asserção falhasse antes disso, todos os testes seguintes falhavam em cascata. Pior: "nunca altera RASCUNHO automaticamente" adiantava 365 dias e **não desfazia**, e o teste seguinte só passava por coincidência (2027 também fica fora da janela). Agora um `beforeEach` repõe o relógio, e o teste da janela de inscrições virou um `it.each` com 3 casos (antes, dentro e depois). |
| `server/tests/integration/auditoria.int.test.ts` | Dependent Test | O teste de falha da auditoria sobrescrevia o `container` do módulo. Agora usa um container local, e o *spy* do `console.error` é restaurado num `afterEach`, mesmo se o teste falhar no meio. |
| `server/tests/integration/auth.int.test.ts` | Conditional Test Logic | Quatro laços `for` sobre entradas inválidas (links adulterados, e-mails de fora da UNICAP, papéis proibidos, payloads inválidos) viraram `it.each`. Cada caso agora é um teste com nome próprio e a falha diz qual entrada quebrou. |
| `server/tests/unit/arquivo.storage.test.ts` | Conditional Test Logic, Exception Handling | Três `if (...) throw new Error(...)` iguais viraram uma asserção dentro do helper `parametros()`. |
| `server/tests/unit/notificacoes.service.test.ts` | Conditional Test Logic, Assertion Roulette | Um laço com 5 asserções por usuário virou uma única asserção sobre o resultado completo. |

---

## 4. Recomendações pendentes (não aplicadas)

| # | Smell | Onde | Sugestão | Prioridade |
|---|---|---|---|---|
| T1 | General Fixture | `server/tests/integration/jornada.int.test.ts` | ✅ **Aplicada.** O `beforeEach` criava 8 contas (gestor, 2 alunos, 4 professores) para todos os 19 testes. Agora ele só monta o container, e cada conta é criada na primeira vez que o teste a usa (`await docente()`, `await idDe('profFis')`), memorizada por container. General Fixture caiu de 24 para 6 testes e o arquivo, de ~35 s para ~22 s (medido no mesmo ambiente). | ~~P2~~ |
| T2 | Assertion Roulette | Jornadas E2E (`web/tests/e2e/jornada.spec.ts`, `server/tests/e2e/*.e2e.ts`) | Usar `test.step('...')` no Playwright e blocos nomeados no Jest, para a falha indicar a etapa da jornada. | P3 |
| T3 | Magic Number Test | Testes de regra | Para valores de regra de negócio (nota de corte, mínimo de caracteres, cota), importar a constante do domínio em vez de repetir o número. Status HTTP podem continuar literais. | P3 |
| T4 | Duplicate Assert | `web/tests/e2e/jornada.spec.ts:159` | Trocar `getByRole('heading').first()` pelo título esperado de cada página (`/oportunidades`, `/pesquisas`). Fica mais preciso e deixa de ser duplicado. | P3 |
| T5 | Exception Handling, Conditional | `portal-lab/e2e/discente.spec.ts` | Protótipo fora do CI. Só vale corrigir se o `portal-lab` voltar a ser mantido. | P3 |

---

## 5. Código morto removido

Achados do `knip` conferidos um a um: só foi removido o que não tinha **nenhum** uso no `server/` (nem no próprio arquivo, nem nos testes).

| Arquivo | Removido | Motivo |
|---|---|---|
| `server/src/modules/auth/dto/auth.dto.ts` | tipos `RegisterDto`, `LoginDto`, `AlterarSenhaDto`, `UpdateUsuarioDto`, `AuthResponse` e o reexport de `PublicUsuario` | Ninguém importava. Os serviços usam os tipos de `domain/auth.types.ts`. |
| `server/src/modules/editais/dto/editais.dto.ts` | tipos `CreateEditalDto`, `UpdateEditalDto`, `TransitionDto` | Sem uso. |
| `server/src/modules/editais/domain/editais.rules.ts` | constante `EDITAL_STATUS` | Sem uso. As transições usam `EDITAL_TRANSITIONS`. |
| `server/src/modules/inscricoes/domain/inscricoes.types.ts` | constante `ANEXO_TIPOS` | Sem uso. |
| `server/src/modules/inscricoes/dto/inscricoes.dto.ts` | tipo `InscricaoResponse` | Sem uso. |
| `server/src/modules/projetos/domain/projetos.types.ts` | constante `RELATORIO_TIPOS` | Sem uso. |
| `server/src/shared/storage/arquivo.dto.ts` | tipo `ConfirmarEnvioDto` | Sem uso. |
| `server/src/shared/http/http.middleware.ts` | função `readUploadFilename` | Sobra do upload antigo pelo header `X-Filename`. Hoje o envio usa URL assinada e nenhum cliente manda esse header. |

### Achados do knip que **não** são código morto

- **Páginas do `web/`** (`LoginPage`, `ProjetoPage` etc.): o router as carrega por nome com `lazy(() => import(...))`, e o knip não vê essa referência.
- **`server/src/vercel.ts`**: carregado por `api/index.js` (função serverless da Vercel).
- **`server/src/infra/copiar-pdfs-para-blob.ts`**: script de migração documentado, roda à mão com `npx tsx`.
- **Arquivos de setup e E2E do Jest**: carregados pelo `jest.config.js` (`globalSetup`, `setupFiles`).
- **`convex/*` do `portal-lab`**: o Convex roteia por arquivo, e sem `convex/_generated` o knip não enxerga o uso.
- **53 exports/tipos no `server/` e cerca de 26 no `web/` (fora as páginas)** que só são usados no próprio arquivo (ex.: `MIN_PARECER`, `projetosKeys`, `parseApiError`). Não são código morto: dá para tirar o `export`, mas é só redução da API pública do módulo, sem ganho de comportamento. Fica opcional.

### Dependências

O knip não encontrou dependência sem uso no `server/` nem no `web/`. No `portal-lab/`, aponta `tailwindcss` em devDependencies.

---

## 6. Observação sobre formatação

`npm run format:check` acusa ~100 arquivos fora do padrão já no commit analisado: o código foi escrito com outra largura de linha e o checkout no Windows usa CRLF. O CI não roda esse passo, então nada quebra, mas vale decidir entre rodar `npm run format` uma vez num commit separado (e incluir o `format:check` no CI) ou remover o script. As alterações desta página **não** reformataram código existente, para o diff mostrar só a limpeza.
