# Testes Finais: carga, estresse, segurança e smoke

> Página da wiki conectada a [[Revisao-e-Otimizacoes]], [[Test-Smells]], [[Arquitetura]] e [[Sprints]].
> Testes feitos em 12/11/2026 sobre a `main` (commit `5242513`), na ordem pedida: carga → estresse → segurança → correções → smoke.
> Scripts e saídas brutas em [`testes-finais/`](../testes-finais) (como repetir: [README](../testes-finais/README.md)).
> Versão em PDF, com os anexos de todas as verificações: [Testes-Finais.pdf](./Testes-Finais.pdf).

---

## 1. Resumo

| Teste | Resultado antes | Problemas achados | Resultado depois das correções |
|---|---|---|---|
| **Carga** | 0% de falhas até 100 conexões, mas o login fazia só 10,5/s (mediana de 887 ms) | Hash de senha lento e travando o servidor | 0% de falhas; login a 55,5/s (mediana de 175 ms) |
| **Estresse** | Sem falhas até 1.600 conexões, quebra em ~2.400, recupera em ~10 s | Logins simultâneos travavam todas as rotas; com o banco fora, as requisições ficavam penduradas | Rotas leves seguem rápidas durante os logins (p99 de 2.286 ms → 6 a 11 ms); com o banco fora, 503 em 3 s (saúde) ou 25 s (demais rotas) |
| **Segurança** | 47 de 51 verificações | Força bruta paralela furava o limite; bloqueio por IP derrubava o campus inteiro; listas gigantes amplificavam memória (Zod); dependências vulneráveis; mensagem errada no 413 | 51 de 52 (a que resta é um risco aceito, seção 4.3) |
| **Smoke** | — | Suítes E2E tentavam enviar e-mail real com o `.env` de quem roda e travavam | 31 de 31 passos do roteiro + todas as suítes do projeto verdes |

Todas as correções têm teste automatizado: o servidor foi de 173 para 187 testes.

---

## 2. Ambiente e método

**Carga e estresse rodam só localmente**, por decisão da equipe: contra a Vercel, uma rajada aciona o firewall anti-DDoS da plataforma (o IP de quem testa passa a receber uma página de verificação) e consome a cota diária do Firestore gratuito. Os scripts recusam qualquer endereço que não seja `localhost`.

| Item | Valor |
|---|---|
| Máquina | AMD Ryzen 7 5825U (8 núcleos, 16 threads), 15 GB de RAM, Windows 11 |
| API | Build de produção (`node dist/index.js`, `NODE_ENV=production`), porta 3100 |
| Banco | Emulador do Firestore (Java 21), populado com o seed de demonstração |
| Gerador de carga | `autocannon` 8.0.0 na mesma máquina |
| E-mail | SMTP desligado nos testes (variáveis vazias): nenhum e-mail real sai |

**Limitações.** O emulador do Firestore não reproduz o desempenho do Firestore de verdade, e o gerador de carga divide a CPU com a API. Os números servem para **comparar antes e depois** e para achar gargalos e pontos de quebra, não para prever a capacidade exata em produção. Na Vercel, a API escala em várias instâncias, então o ponto de quebra local (um processo só) não vale para lá.

Uma "conexão" do teste faz requisições sem pausa. Uma pessoa de verdade lê a tela entre um clique e outro, então 100 conexões equivalem a bem mais de 100 pessoas usando o sistema ao mesmo tempo.

---

## 3. Teste de carga

[`carga.mjs`](../testes-finais/carga.mjs): linha de base de 13 rotas (10 conexões, 10 s cada) e uso misto (rotas de todos os perfis intercaladas) com 10, 50 e 100 conexões.

### 3.1 Linha de base por rota (10 conexões)

| Rota | Antes: req/s · p50 · p99 (ms) | Depois: req/s · p50 · p99 (ms) |
|---|---|---|
| Site (index.html) | 2.565 · 3 · 7 | 4.011 · 2 · 4 |
| Saúde + banco | 648 · 14 · 31 | 793 · 11 · 23 |
| Editais abertos (público) | 311 · 31 · 54 | 427 · 22 · 41 |
| Projetos com vaga (público) | 197 · 49 · 84 | 277 · 34 · 64 |
| Vitrine de pesquisas (público) | 246 · 39 · 66 | 345 · 28 · 47 |
| Sessão /me (aluno) | 771 · 12 · 23 | 856 · 10 · 26 |
| Notificações não lidas (aluno) | 461 · 20 · 37 | 495 · 19 · 35 |
| Minhas candidaturas (aluno) | 172 · 56 · 89 | 193 · 50 · 73 |
| Meus projetos (professor) | 195 · 49 · 78 | 226 · 43 · 64 |
| Minhas avaliações (professor) | 119 · 69 · 464 | 191 · 51 · 71 |
| Painel do gestor | 140 · 68 · 112 | 192 · 50 · 73 |
| Triagem (gestor) | 114 · 84 · 131 | 151 · 64 · 97 |
| **Login (hash de senha)** | **10,5 · 887 · 1.484** | **55,5 · 175 · 303** |

Nenhuma falha em nenhuma rota, antes e depois.

**O que a correção explica.** Só o login mudou por causa do código (troca do `bcryptjs` pelo `bcrypt` nativo, seção 6). As outras rotas não foram alteradas: a melhora delas vem de variação entre rodadas (a primeira pegou o emulador ainda "frio") e não deve ser atribuída às correções.

### 3.2 Uso misto

| Conexões | Antes: req/s · p50 · p99 (ms) | Depois: req/s · p50 · p99 (ms) | Falhas |
|---|---|---|---|
| 10 | 248 · 38 · 88 | 301 · 32 · 70 | 0% |
| 50 | 162 · 199 · 2.420 | 338 · 145 · 290 | 0% |
| 100 | 129 · 545 · 3.682 | 288 · 330 · 739 | 0% |

Com 100 conexões, nem a API (59% de um núcleo) nem o emulador (20%) chegaram perto do limite de CPU. A latência maior vem da fila de leituras no banco, não de processamento. Como no item anterior, parte da diferença entre as rodadas é variação: no teste de estresse, o mesmo cenário com 100 conexões deu p99 de 768 ms antes e de 680 a 842 ms depois.

---

## 4. Teste de estresse

[`estresse.mjs`](../testes-finais/estresse.mjs) e [`queda-do-banco.mjs`](../testes-finais/queda-do-banco.mjs).

### 4.1 Rampa até a quebra

Mistura de rotas, 15 s por nível, timeout de 10 s. Critério de quebra: mais de 5% de falhas ou p99 acima de 10 s.

| Conexões | req/s | p50 (ms) | p99 (ms) | Falhas |
|---|---|---|---|---|
| 50 | 266 | 188 | 373 | 0% |
| 100 | 230 | 436 | 842 | 0% |
| 200 | 253 | 803 | 1.461 | 0% |
| 400 | 229 | 1.681 | 2.935 | 0% |
| 800 | 214 | 3.295 | 5.532 | 0% |
| 1.600 | 236 | 6.598 | 8.467 | 0% |
| **2.400** | **23** | 8.940 | 9.603 | **96%** ← quebra |

- **Capacidade:** cerca de 250 req/s num único processo local. Acima disso, mais usuários só aumentam a fila.
- **O sistema degrada sem falhar** até 1.600 conexões simultâneas: todas as respostas foram 200, só mais lentas.
- **Ponto de quebra (~2.400 conexões):** a fila de conexões do sistema operacional transborda e novas conexões nem chegam a entrar (`ETIMEDOUT`). Não há erro da API.
- **Recuperação:** de volta ao normal **~10 s** depois do pico, sem intervenção. Foi igual antes e depois das correções.

### 4.2 Tempestade de logins

30 logins simultâneos (3 por conta, 10 contas, como no início de um turno no campus), medindo ao mesmo tempo uma rota que não faz nada (`/api/health`):

| | Antes | Depois |
|---|---|---|
| Logins por segundo | 9,5 | 47 a 57 |
| Mediana do login | 2.480 ms | 523 a 628 ms |
| Falhas | 0% | 0% |
| `/api/health` durante os logins, p99 | **2.286 ms** | **6 a 11 ms** |
| `/api/health` durante os logins, req/s | 64 (de 5.000) | 2.000 a 3.200 |

("Depois" traz a menor e a maior de duas rodadas com o mesmo cenário.)

**Achado:** o `bcryptjs` calcula o hash em JavaScript, na thread principal do Node. Durante uma rajada de logins, **todas as outras requisições ficavam paradas**. Na Vercel, com o Fluid Compute (padrão em projetos novos), várias requisições dividem a mesma instância, então o efeito seria o mesmo.

### 4.3 Falta de recursos

**Corpo gigante (2 MB de JSON em rajada):** 2.264 respostas 413, nenhum erro, e o servidor seguiu saudável. A mensagem, porém, dizia "Arquivo acima do limite de 10 MB" para um JSON (corrigido).

**Queda do banco com o sistema no ar** (emulador derrubado por ~20 s e religado):

| | Antes | Depois |
|---|---|---|
| `/api/health` (o processo está vivo?) | 200 o tempo todo | 200 o tempo todo |
| `/api/health/ready` (o banco está ok?) | **Pendurado**, sem resposta | **503 "banco indisponível" em 3 s** |
| Rotas que usam o banco | **Penduradas** até o banco voltar | **503 em JSON em 25 s**, com mensagem amigável |
| Banco de volta | Tudo volta sozinho | Tudo volta sozinho em menos de 1 s |

**Achado:** o cliente do Firestore fica tentando reconectar e não desiste. Na Vercel, o usuário ficaria com a tela carregando até a plataforma derrubar a função aos 30 s, com uma página de erro dela. E o `/api/health/ready`, que existe justamente para avisar "banco fora", não respondia.

---

## 5. Teste de segurança

[`seguranca.mjs`](../testes-finais/seguranca.mjs): 52 verificações automatizadas contra a API local (resultado completo em [`resultados/seguranca-local.md`](../testes-finais/resultados/seguranca-local.md)). Além delas: auditoria de dependências, busca de segredos no histórico do Git e checagem das regras do Firestore de produção.

### 5.1 O que já estava protegido (passou de primeira)

| Grupo | Verificações |
|---|---|
| **Autenticação** | 17 rotas protegidas recusam acesso sem token; JWT malformado, com `alg: none`, assinado com segredo errado ou expirado é recusado; um JWT válido de aluno com papel "GESTOR" forjado no token não dá acesso, porque o papel é lido do banco; conta não confirmada não entra; trocar a senha derruba as sessões antigas |
| **Autorização** | Aluno, professor e visitante recebem 403 nas 7 rotas de gestor; aluno não consegue se promover; ninguém lê projeto em avaliação, parecer, candidatura, notificação, currículo ou relatório de outra pessoa (respostas 404, que não revelam nem que o recurso existe); o avaliador indicado lê o projeto que avalia |
| **Entradas** | Cadastro não aceita papel GESTOR, campos extras (`emailPendente: false`) nem domínio de fora (`@gmail.com`, `@unicap.br.evil.com`, `@evilunicap.br`); operadores na query (`?q[$gt]=`) não quebram nada; JSON malformado responde 400 sem stack trace; senha fraca é recusada |
| **Arquivos** | Um arquivo que não é PDF, enviado como PDF, é recusado pela assinatura `%PDF-`; link de envio adulterado dá 403; path traversal (`../../.env`) dá 400; não dá para registrar como seu o arquivo enviado por outra pessoa; link de leitura adulterado dá 403 |
| **Links por e-mail** | Links de confirmação e de nova senha valem uma vez só e recusam adulteração; nome com HTML chega escapado no e-mail; "esqueci minha senha" e o login respondem igual exista ou não a conta |
| **Configuração** | CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy` e COOP presentes; sem `X-Powered-By`; nenhum CORS para outras origens; rotas de tarefa agendada só com o segredo certo |
| **Produção** | Leitura anônima direta no Firestore de produção é recusada (`PERMISSION_DENIED`): as regras de segurança estão publicadas. Nenhum segredo no histórico do Git. HSTS ativo (Vercel) |

### 5.2 Problemas encontrados

| # | Severidade | Problema | Como foi confirmado |
|---|---|---|---|
| S1 | 🔴 Alta | **Força bruta por concorrência:** 30 senhas disparadas em paralelo eram **todas testadas**, apesar do limite de 10 | O limitador consultava o contador antes do bcrypt e só somava depois; a rajada inteira passava pela consulta com o contador em zero |
| S2 | 🔴 Alta | **Bloqueio coletivo:** 10 senhas erradas em qualquer conta bloqueavam o login de **todos** que saem pelo mesmo IP. No Wi-Fi do campus, um aluno tiraria o acesso de todo mundo por 15 min. O mesmo valia para "esqueci a senha" (5 pedidos), cadastro (20 por hora, menos que uma turma) e troca de senha | Depois do ataque à conta de uma aluna, outra pessoa com a senha certa recebia 429 |
| S3 | 🔴 Alta | **Amplificação de memória (Zod 3, GHSA-mrhx-c7xc-m3w5):** uma lista de 500 mil itens (~1 MB) enviada por qualquer professor gerava uma resposta de **17 MB** e subia a memória da API de **135 para 522 MB**. Algumas em paralelo esgotariam uma instância | Medido na API local |
| S4 | 🟠 Alta (dependência) | `body-parser` < 1.20.9 (negação de serviço) e outras dependências com falhas conhecidas (`qs`, `glob`, `minimatch`…) | `npm audit` |
| S5 | 🟡 Baixa | 413 dizia "Arquivo acima do limite de 10 MB" para qualquer JSON grande | Verificação C8 |
| S6 | 🟡 Baixa | Cadastro com e-mail já usado responde "Já existe uma conta com este e-mail", o que permite descobrir quem tem conta | Verificação E7 (ver 5.4) |

### 5.3 Depois das correções

| Verificação | Antes | Depois |
|---|---|---|
| 30 senhas erradas em paralelo | 30 testadas | **0 testadas**, todas bloqueadas |
| Senhas erradas em sequência | bloqueio após 10 | **exatamente 10 testadas**, depois bloqueio (mesmo com a senha certa) |
| Outra pessoa da mesma rede, com a senha certa | 429 | **200** |
| "Esqueci a senha" para o mesmo e-mail | limite por IP | **limite por e-mail** (3 em 15 min) |
| Lista de 500 mil itens | 17 MB de resposta, +390 MB de memória | **400 com menos de 5 KB**, em menos de 2 s |
| Total | 47 de 51 | **51 de 52** |

### 5.4 Riscos aceitos e pendências

| Item | Decisão |
|---|---|
| **S6, enumeração pelo cadastro** | **Aceito.** Só e-mails @unicap.br se cadastram, e esses endereços já são públicos na instituição; o cadastro tem limite por rede; e esconder a resposta pioraria a vida de quem já tem conta e esqueceu (a mensagem atual orienta a usar "Esqueci minha senha"). |
| **Zod 3 e React Router 6** (alertas restantes do `npm audit`) | **Mitigados, sem migração agora.** As versões corrigidas são as maiores (Zod 4, React Router 7). O vetor do Zod foi fechado pela correção da seção 6 e vale também para os alertas do `@vercel/blob`, que vêm do Zod embutido na CLI da Vercel, sem entrada do usuário. A falha do React Router (redirecionamento aberto) não se aplica: o redirecionamento pós-login só aceita caminhos internos ([guards.tsx](../web/src/app/guards.tsx)). A migração entra no backlog. |
| `glob`, `minimatch`, `gaxios` (moderadas) | Aninhadas em dependências do `firebase-admin`, usadas com caminhos fixos, sem entrada do usuário. Saem quando o `firebase-admin` atualizar. |
| 🔴 **Contas de demonstração em produção** | **Pendente, decisão da equipe.** O banco de produção tem as contas do seed antigo (`gestor@pibic.edu.br` / `gestor123` e as demais), com senhas publicadas no histórico do repositório público. Verificado em 29/10: o login de gestor funciona em produção. Ação: trocar a senha ou excluir essas contas antes do uso real. |
| 🔴 **Segredos que circularam fora do cofre** | **Pendente.** Durante a configuração do novo deploy (29/10), alguns segredos de produção foram colados em conversas e capturas de tela. Ação: gerar novos `JWT_SECRET` e `CRON_SECRET`, uma nova senha de app do Gmail e uma nova chave do Firebase (apagando as antigas no Google Cloud), e atualizar na Vercel. |

---

## 6. Correções aplicadas

| # | Correção | Arquivos |
|---|---|---|
| C1 | **`bcrypt` nativo** no lugar do `bcryptjs`: o hash roda no pool de threads do Node, fora da thread principal. Os hashes já gravados (`$2a$`) continuam valendo, sem migração. Há binários prontos para Linux (Vercel) e Windows | [`auth.service.ts`](../server/src/modules/auth/auth.service.ts), `seed.ts`, `package.json` |
| C2 | **Prazo nas requisições:** `/api/health/ready` responde 503 em 3 s se o banco não responder; qualquer rota responde 503 em JSON em 25 s (abaixo dos 30 s da função na Vercel). O tratador de erros ignora erros que chegam depois de a resposta ter saído | [`http.middleware.ts`](../server/src/shared/http/http.middleware.ts), [`app.container.ts`](../server/src/infra/config/app.container.ts) |
| C3 | **Limite de tentativas reescrito:** a tentativa é **reservada antes** de a rota rodar (soma atômica) e devolvida se o login der certo ou se a tentativa for recusada, então uma rajada não fura o limite | [`security.middleware.ts`](../server/src/shared/http/security.middleware.ts) |
| C4 | **Limites por conta:** login por IP + e-mail (10 erros em 15 min), com teto de 100 erros por IP; "esqueci a senha" e "reenviar link" por e-mail de destino (3 em 15 min), com teto de 30 por IP; troca de senha por sessão; cadastro de 20 para 60 por hora por rede | [`app.container.ts`](../server/src/infra/config/app.container.ts) |
| C5 | **Contador no Firestore sem transação:** um documento por janela de 15 min e incremento atômico nativo. O contador por IP, que todo login do campus toca, só lê quando o login dá certo | [`firestore.rate-limit.store.ts`](../server/src/infra/firestore/firestore.rate-limit.store.ts) |
| C6 | **Listas limitadas antes da validação** (`listaLimitada`): no máximo `máximo + 1` itens chegam ao Zod, nas 5 listas que vêm do usuário; as cotas do edital ganharam teto de 200. Os erros de validação devolvidos ficam limitados a 20 | [`lista.ts`](../server/src/shared/validation/lista.ts), DTOs de editais, inscrições e avaliações, `http.middleware.ts` |
| C7 | `npm audit fix` (só atualizações compatíveis): `body-parser` 1.20.9, `qs` 6.16.2 e dependências de desenvolvimento do front | `package-lock.json` (server e web) |
| C8 | Mensagem do 413 conforme o tipo: "Arquivo acima do limite de 10 MB" para PDF, "Dados enviados acima do tamanho permitido" para JSON | `http.middleware.ts` |
| C9 | **Testes nunca enviam e-mail real:** os E2E de API e o servidor do Playwright forçam o SMTP vazio e o banco no emulador, mesmo que o `server/.env` de quem roda tenha o Gmail do projeto. Antes, a tentativa de SMTP real fazia o Jest não encerrar (a suíte travava por mais de 20 min) | [`tests/e2e/setup-env.js`](../server/tests/e2e/setup-env.js), [`web/playwright.config.ts`](../web/playwright.config.ts) |

### Uma regressão que os próprios testes pegaram

A primeira versão de C3 usava uma **transação** do Firestore para somar a tentativa. Ao repetir o estresse com a correção, um login certo passou a levar **12,5 s**, e o log mostrou `Transaction lock timeout`: os logins simultâneos do mesmo IP disputavam o mesmo documento. Pior, quando a transação expirava, o limitador liberava a requisição, e no Firestore real uma rajada voltaria a furar o limite. Os testes em memória não mostravam isso. A versão final (C5) não usa transação, e o estresse seguinte não registrou nenhum aviso do limitador.

### Testes automatizados novos

- **Integração** ([`auth.int.test.ts`](../server/tests/integration/auth.int.test.ts)): rajada paralela testa no máximo 10 senhas e depois bloqueia; o bloqueio de uma conta não impede outra pessoa da mesma rede; "esqueci a senha" é limitado por e-mail; 413 com a mensagem certa; lista de 500 mil itens recusada em menos de 2 s, com resposta de menos de 5 KB.
- **Unidade** ([`endurecimento.test.ts`](../server/tests/unit/endurecimento.test.ts)): `listaLimitada`, `comPrazo`, `prazoDaRequisicao` (503 no prazo; erro depois do 503 não responde de novo) e o contador em memória.
- **E2E no Firestore** ([`concorrencia.firestore.e2e.ts`](../server/tests/e2e/concorrencia.firestore.e2e.ts)): 30 somas simultâneas no mesmo contador sem perda nem trava, devolução da reserva e virada de janela.

---

## 7. Smoke test da versão nova

| Suíte | Onde roda | Resultado |
|---|---|---|
| Typecheck e ESLint (server e web) | local | ✅ sem erros e sem avisos |
| Unidade + integração do servidor (memória) | local | ✅ 187 de 187 |
| Unidade do front (Vitest) | local | ✅ 7 de 7 |
| Integração do servidor no Firestore | emulador | ✅ 96 de 96 |
| E2E de API (jornadas do gestor, concorrência) | emulador | ✅ 7 de 7 |
| **E2E no navegador (Playwright, Chromium)** | emulador + build completa | ✅ 3 de 3: ciclo completo (edital, divulgação, candidatura, seleção, três pareceres, homologação e relatório mensal); rotas protegidas por papel; 404 público sem violação de CSP |
| **Roteiro de smoke** ([`smoke.mjs`](../testes-finais/smoke.mjs)) | build completa (API servindo o site) | ✅ 31 de 31 passos: site e rotas da SPA, saúde, parte pública, cadastro com confirmação por link, e o caminho crítico do gestor, do professor, do aluno e do visitante |

**Depois do deploy:** `node testes-finais/smoke.mjs --url=https://SEU-PROJETO.vercel.app`. Nesse modo, o roteiro só faz leituras públicas (uma dúzia de requisições, nada é gravado), para confirmar que a versão publicada está de pé.
