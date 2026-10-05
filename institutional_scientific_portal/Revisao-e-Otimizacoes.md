# Revisão Geral e Plano de Otimizações

> Página da wiki conectada a [[PROJECT_BRAIN]], [[Arquitetura]], [[DESIGN]] e [[Sprints]].
> Revisão feita em 05/10/2026 sobre o estado da `main` (commit `6e8c03f`, após a S7 "endurecimento e CI").
> Escopo: `server/` (API Express + Prisma), `web/` (SPA React), `portal-lab/` (protótipo Convex), documentação e CI.

---

## 1. Resumo executivo

O projeto está em **bom estado**: arquitetura hexagonal limpa no back-end, regras de negócio puras e testadas, TypeScript estrito, Zod nas bordas, CSP e rate limit no login, upload com checagem da assinatura `%PDF-`, CSV protegido contra injeção de fórmulas e um front organizado por feature, com code splitting por rota e boa base de acessibilidade (skip link, foco visível, `<dialog>` nativo e status que não dependem só da cor).

**Verificação na revisão**: `tsc` e ESLint passaram sem erros nos dois projetos. Os testes do server passaram (111/111, Jest unit + integration), e os do web também (7/7, Vitest). Os E2E não foram executados nesta revisão.

Os pontos que mais pedem atenção:

1. **Consistência de dados sob concorrência**: o protocolo e a cota de bolsas podem ser violados com duas requisições simultâneas.
2. **Erros do Prisma viram HTTP 500**: violações de unicidade e registros não encontrados não são traduzidos.
3. **Desempenho que degrada com o volume**: há consultas N+1, agregações feitas em memória, nenhuma paginação e GETs públicos que gravam no banco.
4. **Segurança de autenticação**: o JWT fica no `localStorage`, qualquer pessoa pode se cadastrar como DOCENTE, a política de senha é fraca e o Express está numa versão com CVEs conhecidas.
5. **Documentação desatualizada**: os docs ainda descrevem a stack Convex/shadcn/Bun, que não é a aplicação principal.
6. **Design**: o painel e as tabelas ficaram mais simples que os mockups do Stitch, e cores fora dos tokens do design system se espalham pelos componentes.

Legenda de prioridade: **P0** = corrigir antes de qualquer uso real · **P1** = próxima sprint · **P2** = planejar · **P3** = desejável.
Esforço: **P** (≤ 2 h) · **M** (≤ 1 dia) · **G** (> 1 dia).

---

## 2. Achados críticos (P0)

| # | Problema | Onde | Impacto | Correção | Esforço |
|---|---|---|---|---|---|
| C1 | Dependência circular acidental `"portal-pibic": "file:.."` em `server/package.json` e `web/package.json` (alteração local, ainda não commitada) | `server/package.json`, `web/package.json` e os lockfiles | Os pacotes passam a depender da raiz do monorepo. Se for commitada, quebra `npm ci` no CI. | Reverter: `git checkout -- server/package.json server/package-lock.json web/package.json web/package-lock.json`. Provavelmente veio de um `npm install` rodado na pasta errada. | P |
| C2 | **Corrida na geração do protocolo**: `countProtocolosNoAno() + 1` não é atômico | `inscricoes.service.ts` → `submeter()`; `prisma.inscricoes.repository.ts` → `countProtocolosNoAno()` | Duas submissões simultâneas geram o mesmo número. O `@unique` barra a segunda, que recebe **500**. A contagem usa `LIKE '%/2026-%'` (varredura completa). | Criar a tabela `SequenciaProtocolo { ano Int @id, ultimo Int }` e incrementar com `upsert` + `increment` dentro de `$transaction`. | M |
| C3 | **Corrida na homologação por cota**: conta as aprovadas e depois grava, sem transação | `avaliacoes.service.ts` → `homologar()` | Dois gestores aprovando ao mesmo tempo podem **ultrapassar a cota** da subárea, o que fere uma regra de negócio central. | Fazer a contagem e o update numa `prisma.$transaction(async tx => …)`. No PostgreSQL, usar `isolationLevel: 'Serializable'` ou `SELECT … FOR UPDATE` na linha do edital. Exige expor uma porta transacional (*unit of work*) nos repositórios. | M |
| C4 | Erros do Prisma não são mapeados: P2002 (unicidade) e P2025 (não encontrado) caem em 500 | `shared/http/http.middleware.ts` → `errorHandler` | A atribuição duplicada de avaliador, o protocolo duplicado e outros casos viram "Erro interno". | No `errorHandler`, tratar `Prisma.PrismaClientKnownRequestError`: P2002 → 409, P2025 → 404. | P |
| C5 | `markAsRead` lança `Error` genérico | `prisma.notificacoes.repository.ts` | Uma notificação inexistente ou de outro usuário retorna **500** em vez de 404. | Lançar `NotFoundError`. | P |
| C6 | O update do edital apaga as cotas **fora de transação** | `prisma.editais.repository.ts` → `update()` | Se o `update` falhar depois do `deleteMany`, o edital fica sem cotas. | Envolver os dois passos em `$transaction`, como já é feito em `PrismaInscricoesRepository.update`. | P |
| C7 | `npm start` roda `tsx watch` (modo dev) e não define `NODE_ENV` | `package.json` (raiz) | A "produção" roda em modo watch, e a validação do `JWT_SECRET` forte **nunca é acionada**. | Adicionar `start:prod`: `npm run build --prefix server && NODE_ENV=production node server/dist/index.js` (o `tsc` precisa resolver os aliases `@shared/*`: usar `tsc-alias` ou `tsup`). | M |

---

## 3. Segurança

| # | Achado | Recomendação | Prioridade | Esforço |
|---|---|---|---|---|
| S1 | **Express 4.19.2** está fixado, e as CVEs de `path-to-regexp` (ReDoS, CVE-2024-45296) e `body-parser` (CVE-2024-45590) só foram corrigidas na 4.20+. O Vite 5.4.3 também tem avisos de segurança no dev server. | Atualizar para `express@4.21.x` (ou 5.x) e `vite@5.4.x` mais recente. Rodar `npm audit` e acrescentar esse passo ao CI. | P0 | P |
| S2 | O JWT fica em `localStorage`, então qualquer XSS pode roubar a sessão de 8 h. | Migrar para um cookie `httpOnly; Secure; SameSite=Strict` com proteção CSRF (header customizado ou double-submit). No mínimo, reduzir o TTL e adicionar refresh token. | P1 | G |
| S3 | **Cadastro livre como DOCENTE**: qualquer pessoa vira orientador, confirma vínculos e avalia relatórios. | Cadastrar como `USUARIO` com "papel solicitado" e deixar a promoção em fila de homologação pelo gestor (o `portal-lab` já tinha esse fluxo). Outra opção é validar por domínio de e-mail institucional. | P1 | M |
| S4 | A política de senha exige só 6 caracteres e não tem limite máximo (o bcrypt trunca em 72 bytes). | Exigir mínimo de 8 caracteres com maiúscula, minúscula e número (como no `portal-lab`) e máximo de 72 bytes. A regra deve ficar no DTO e no front. | P1 | P |
| S5 | Enumeração de usuários por tempo de resposta: o `bcrypt.compare` só roda quando o e-mail existe. | Comparar contra um hash fictício quando o usuário não existe. | P2 | P |
| S6 | O rate limit usa `req.ip` sem `trust proxy`. Atrás de um proxy reverso, todos os usuários compartilham o mesmo IP e o bloqueio fica coletivo. | Usar `app.set('trust proxy', 1)` quando houver proxy (configurável por env). Com várias instâncias, guardar os contadores no Redis. | P2 | P |
| S7 | Não há logout no servidor nem revogação de token. | Adicionar `tokenVersion` no usuário, incluí-lo no JWT e invalidar a sessão ao trocar a senha ou o papel. | P2 | M |
| S8 | Não existe recuperação de senha (pendência da S1). | Fluxo com token de uso único por e-mail, com expiração de 30 min. | P2 | G |
| S9 | `escaparCsv` não neutraliza fórmulas que começam com `\t` ou `\r`. | Incluir `\t` e `\r` na regex `^[=+\-@]`. | P3 | P |
| S10 | A vitrine pública expõe o **nome do bolsista**. | Confirmar a base legal ou o consentimento (LGPD) e registrar o aceite no cadastro, ou exibir só as iniciais. | P2 | P |

---

## 4. Otimizações de desempenho (back-end)

| # | Problema | Onde | Correção | Prioridade | Esforço |
|---|---|---|---|---|---|
| D1 | **N+1 grave na publicação de edital**: para cada usuário, carrega todas as notificações dele e depois cria uma por vez (O(usuários × notificações)) | `notificacoes.service.ts` → `handleEditalPublicado` | Um único `findMany({ where: { tipo, referenceId } })` para descobrir quem já foi notificado, seguido de **`createMany`**. | P1 | P |
| D2 | `markAllAsRead` faz N updates | `notificacoes.service.ts` | Um único `updateMany({ where: { userId, lida: false } })`. | P1 | P |
| D3 | **GETs públicos gravam no banco**: `syncAutomaticClosure()` roda em toda listagem de editais, inclusive nas rotas anônimas | `editais.service.ts`, `publico.controller.ts` | Rodar o encerramento num job agendado (`setInterval` a cada minuto ou `node-cron`) ou derivar o status na leitura (`dataFim < agora` ⇒ encerrado) sem gravar. Também remove um vetor de carga anônima. | P1 | M |
| D4 | N+1 na triagem: `avaliacoesResponse` chama `findManyByIds` uma vez **por item** | `avaliacoes.controller.ts` → `itensResponse` | Juntar todos os `avaliadorId` da fila e fazer uma única consulta. | P1 | P |
| D5 | O painel do gestor carrega **todas** as avaliações e relatórios do banco e filtra em memória | `dashboard.service.ts` | Filtrar com `inscricaoId: { in: ids }` e usar `groupBy`/`count` do Prisma para os contadores. | P1 | M |
| D6 | A vitrine pública traz tudo, busca texto em JS e carrega os editais em laço sequencial | `publico.controller.ts` → `/api/publico/pesquisas` | Mover filtros e busca para o `where` (`contains`, ou FTS no Postgres), carregar os editais com um `findMany({ id: { in } })`, paginar e enviar `Cache-Control: public, max-age=60` + `ETag`. | P1 | M |
| D7 | **O auto-save apaga e recria todos os anexos** a cada PATCH (debounce de 800 ms) | `prisma.inscricoes.repository.ts` → `update()` | Separar `updateCampos()` (só escalares) de `upsertAnexo()`/`removeAnexo()`. Reduz as escritas em ~3x por salvamento. | P1 | M |
| D8 | **Nenhuma listagem é paginada**: inscrições, triagem, usuários, notificações, projetos e vitrine | controllers e repositórios | Padronizar `?page=&pageSize=` (ou cursor) com resposta `{ data, total, page }` e limite máximo de 100. | P1 | G |
| D9 | O sino de notificações faz polling da **lista inteira** a cada 30 s | `web/src/features/notificacoes/api.ts` + `AppShell` | Criar o endpoint `GET /api/notificacoes/nao-lidas/contagem` para o sino e paginar a página de notificações. | P1 | P |
| D10 | Faltam índices | `schema.prisma` | Adicionar `Inscricao @@index([discenteId])`, `@@index([editalId, status])` e `@@index([editalId, subareaCode, status])`; `Notificacao @@index([userId, criadoEm])`; `Avaliacao @@index([status])`. | P1 | P |
| D11 | Arquivos órfãos: o PDF é salvo antes do update no banco, e se o banco falhar o arquivo fica no disco | `inscricoes.service.ts` → `anexar`, `projetos.service.ts` | Fazer remoção compensatória em `catch` e/ou um job de limpeza periódica de `uploads/` sem referência. | P2 | P |
| D12 | Falta graceful shutdown | `server/src/index.ts` | Tratar `SIGTERM`/`SIGINT` com `server.close()` + `prisma.$disconnect()`. | P2 | P |

### Front-end

| # | Problema | Correção | Prioridade | Esforço |
|---|---|---|---|---|
| F1 | O bundle inicial (`index-*.js`) tem **~400 KB** minificado e inclui Zod, react-hook-form, Login e Cadastro, mesmo para quem só visita a vitrine. | Carregar `LoginPage`, `CadastroPage` e `EditaisPublicosPage` com `lazy`, separar o vendor em `build.rollupOptions.output.manualChunks` (`react`, `router`, `query`, `forms`) e medir com `rollup-plugin-visualizer`. | P1 | P |
| F2 | As fontes vêm do Google Fonts (CSS bloqueante, requisição a terceiros, questão de LGPD). | Hospedar as fontes localmente com `@fontsource/inter`, `@fontsource/plus-jakarta-sans` e `@fontsource/jetbrains-mono` (apenas os pesos usados), e simplificar a CSP. | P2 | P |
| F3 | O carregamento usa spinner centralizado (causa CLS e piora a percepção de velocidade). | Usar componentes `Skeleton` para cards, tabelas e KPIs. | P2 | M |
| F4 | Os tipos da API são escritos à mão no `web` (`shared/types/api.ts`, 305 linhas) e duplicam os DTOs do server. | npm workspaces + um pacote `packages/contracts` com os schemas Zod compartilhados, ou geração via OpenAPI (`zod-to-openapi` + `openapi-typescript`). | P2 | G |

---

## 5. Arquitetura, manutenção e qualidade

| # | Achado | Recomendação | Prioridade | Esforço |
|---|---|---|---|---|
| A1 | **Três implementações convivem**: `portal-lab/` (Convex, React 19, Tailwind 4, Zod 4), `server/`+`web/` (Express, React 18, Tailwind 3, Zod 3) e `prototipo/`. | Arquivar o `portal-lab` numa tag/branch `archive/portal-lab` e removê-lo da `main`. Isso evita confusão e manutenção dupla. | P1 | P |
| A2 | **A documentação descreve a stack errada**: `PROJECT_BRAIN.md` e `Arquitetura.md` falam em Convex, shadcn/ui, Bun e Framer Motion, e o modelo de dados é o do Convex. | Reescrever as seções de stack, pastas e modelo de dados de acordo com o `server/` e o `web/` (o README já está correto). | P1 | M |
| A3 | Os wikilinks apontam para páginas que não existem: `[[Qualidade]]`, `[[Definition-of-Done]]`, `[[Gestao-de-Projeto]]` e `[[Modulo-*]]`. | Criar essas páginas ou remover os links. | P2 | M |
| A4 | O `.freebuff/run.md` versionado contém um caminho pessoal (`/Users/henriquevalenca/...`) e instruções de launchd do macOS. | Remover do repositório e adicionar `.freebuff/` ao `.gitignore`. | P1 | P |
| A5 | **Sem integridade referencial com `Usuario`**: `Inscricao.discenteId`, `orientadorId` e `Avaliacao.avaliadorId` não têm FK. | Declarar as relações no Prisma (com `onDelete: Restrict`). | P2 | M |
| A6 | Os bancos são gerenciados com `prisma db push` (sem migrations) e SQLite. | Adotar `prisma migrate` e versionar `migrations/`. Planejar o PostgreSQL para produção, o que também resolve os locks de escrita do SQLite. | P2 | M |
| A7 | As notas da avaliação ficam como string JSON. | Aceitável no SQLite. No Postgres, usar `Json` ou uma tabela `NotaCriterio`. | P3 | M |
| A8 | Código morto: `AuthService.verifyTokenSync` e `assertSenhaForte` não são usados. `/api/auth/me` reimplementa a leitura do Bearer em vez de usar o guard. | Remover os dois métodos e usar `authenticationGuard` na rota `/me`. | P3 | P |
| A9 | Os logs se resumem a `console.error`, sem correlação entre requisições. O `/api/health` não verifica o banco. | Adotar logger estruturado (`pino` + `pino-http`) com `requestId`, e fazer o health rodar `SELECT 1`. | P2 | M |
| A10 | A raiz não usa workspaces: cada pacote tem lockfile e `node_modules` próprios (~480 MB). | Converter a raiz em **npm workspaces** (`"workspaces": ["server", "web"]`): uma instalação, um lockfile e uma base para o pacote de contratos (F4). | P2 | M |
| A11 | Os testes do front se limitam a 2 arquivos Vitest de lógica pura (7 testes), sem testes de componente. A meta da S7 é cobertura ≥ 80%. | Adicionar Testing Library para o wizard, os guards e o `useAutoSave`; publicar a cobertura no CI (`--coverage` + limite mínimo). | P1 | G |
| A12 | O CI não roda auditoria de dependências nem de acessibilidade. | Adicionar os passos `npm audit --audit-level=high`, `@axe-core/playwright` nas jornadas E2E e Lighthouse CI na vitrine (meta ≥ 90, de [[PROJECT_BRAIN]]). | P1 | M |
| A13 | Os E2E de API **limpam o banco de desenvolvimento**. | Usar um `DATABASE_URL` próprio para testes (`file:./test.db`), definido no script. | P2 | P |

---

## 6. Design e UX

Comparei os mockups do Stitch (`painel_do_gestor_m_tricas/`, `central_de_triagem_de_solicita_es/` etc.) com a implementação atual.

### 6.1 Diferenças em relação aos mockups

| # | Melhoria | Detalhe | Prioridade | Esforço |
|---|---|---|---|---|
| UX1 | **Visualizações no painel do gestor** | O mockup tem donut por grande área CNPq, status por unidade e fluxo mensal. A implementação só tem barras de progresso. Sugestões: (a) distribuição por **grande área**, em barras horizontais, mais legível que donut; (b) **submissões por semana** em linha durante o período de inscrição; (c) KPIs com **delta em relação ao ciclo anterior**. Usar Recharts ou SVG próprio, com carregamento sob demanda. | P2 | G |
| UX2 | **Componente `DataTable` compartilhado** | O mockup tem busca, filtros em select, ordenação e paginação ("1 / 357"). As tabelas atuais não ordenam nem paginam. Criar um `DataTable` com cabeçalho ordenável (`aria-sort`), paginação, estado vazio e **modo "cards" no mobile**, que o [[DESIGN]] exige ("tables collapse into stacked metadata record cards") e que hoje é só `overflow-x-auto`. | P1 | G |
| UX3 | **Busca global ⌘K** | Está especificada no [[DESIGN]] ("shortcut badge ⌘K") e não foi implementada. Seria uma paleta de comandos para achar protocolo, edital ou proposta. | P3 | M |
| UX4 | **Faixa do edital vigente** | O mockup mostra no topo uma barra com o edital aberto e o prazo final ("Prazo final: 31 de outubro"). Isso aumenta muito a descoberta do edital na vitrine e para discentes. | P2 | P |
| UX5 | **Breadcrumbs** | Estão previstos em [[Arquitetura]] (layout) e ausentes no AppShell. Ajudam em `/triagem/:id`, `/gestor/editais/:id/editar` etc. | P2 | P |

### 6.2 Consistência do design system

| # | Melhoria | Detalhe | Prioridade | Esforço |
|---|---|---|---|---|
| DS1 | **Tokens semânticos de estado** | O [[DESIGN]] diz "nenhuma cor hardcoded", mas há **92 usos** de `emerald-*`, `amber-*`, `rose-*`, `sky-*` e `slate-*` direto nos componentes. Criar `success`, `warning`, `danger` e `info` (com `DEFAULT`, `soft`, `border`, `ink`) no `tailwind.config.js`, migrar e adicionar uma regra de lint (`eslint-plugin-tailwindcss` com `no-arbitrary-value` / lista de cores). | P2 | M |
| DS2 | **Badge de notificação inconsistente** | É `amber-400` na sidebar e `rose-600` no topo para a mesma informação. Unificar a cor. | P3 | P |
| DS3 | **Duas paletas no DESIGN.md** | O *frontmatter* usa tokens estilo Material (`surface-container-*`, `primary #00142f`) e a prosa usa a paleta slate/tailwind. Escolher uma, que é a que o `tailwind.config.js` já usa, e limpar o outro conjunto. | P2 | P |
| DS4 | **Modo escuro** (opcional) | Com os tokens semânticos (DS1) no lugar, o tema escuro custa pouco: variáveis CSS mais `prefers-color-scheme`. É útil para avaliadores que leem muitos PDFs. | P3 | M |

### 6.3 Acessibilidade

| # | Melhoria | Detalhe | Prioridade | Esforço |
|---|---|---|---|---|
| AC1 | **Gaveta do menu mobile** | Tem `role="dialog"` e `aria-modal`, mas **não prende o foco**, **não fecha com Esc** e não devolve o foco ao botão. Reaproveitar o `<dialog>` nativo, como no `Dialog.tsx`. | P1 | P |
| AC2 | **`id="dialog-title"` fixo** | Se houver dois diálogos montados, os IDs se repetem e o `aria-labelledby` fica ambíguo. Usar `useId()`. | P2 | P |
| AC3 | **Auditoria automatizada** | Rodar `@axe-core/playwright` em cada página das jornadas E2E (ver A12). | P1 | M |
| AC4 | **Anúncio do auto-save** | Garantir que o indicador "Rascunho salvo" use `aria-live="polite"` para leitores de tela. | P3 | P |

---

## 7. Plano de execução sugerido

Distribuição pelas sprints restantes ([[Sprints]]):

### S7 — Endurecimento (atual)
- [ ] C1 Reverter a dependência `file:..` acidental
- [ ] C2 Sequência atômica de protocolo
- [ ] C3 Homologação transacional (cota)
- [ ] C4/C5 Mapear erros do Prisma e corrigir `markAsRead`
- [ ] C6 Transação no update de edital
- [ ] C7 Script `start:prod` com `NODE_ENV=production`
- [ ] S1 Atualizar Express/Vite e adicionar `npm audit` ao CI
- [ ] S3/S4 Homologação de docentes e política de senha
- [ ] D1/D2/D4/D10 Corrigir os N+1 e adicionar os índices (ganhos rápidos)
- [ ] A1/A2/A4 Arquivar o `portal-lab`, atualizar os docs e remover o `.freebuff`
- [ ] AC1/AC3 Gaveta acessível e axe no E2E
- [ ] A11/A12 Cobertura ≥ 80% e auditorias no CI

### S8 — Release
- [ ] D3 Job de encerramento automático fora dos GETs
- [ ] D5/D6/D7/D8/D9 Agregações no banco, paginação e contagem de não lidas
- [ ] F1/F2 Divisão do bundle e fontes hospedadas localmente
- [ ] UX2 `DataTable` com paginação e modo cards no mobile
- [ ] DS1/DS3 Tokens semânticos e DESIGN.md consolidado
- [ ] A6 Migrations do Prisma e roteiro para PostgreSQL

### Pós-release (backlog)
- [ ] S2/S7/S8 Sessão em cookie httpOnly, revogação e recuperação de senha
- [ ] UX1 Gráficos no painel
- [ ] UX3/UX4/UX5 Busca ⌘K, faixa do edital e breadcrumbs
- [ ] F4/A10 Workspaces e contratos compartilhados
- [ ] DS4 Modo escuro

---

## 8. Status das correções (05/10/2026)

**Verificação depois das correções**: `tsc` e ESLint passam sem erros nos dois projetos. Os testes do server passam (111/111) e os do web também (7/7), assim como o `vite build`. O `npm audit` do server zerou. Um smoke test rodou contra o build de produção num banco separado:
- 4 submissões simultâneas receberam 4 protocolos distintos;
- 4 aprovações simultâneas numa subárea com 2 cotas resultaram em exatamente 2 aprovadas e 2 recusadas com 422.

### Feito

| Item | O que mudou |
|---|---|
| C1 | Revertida a dependência `file:..` acidental. |
| C2 | Nova tabela `SequenciaProtocolo`. A reserva do sequencial é atômica e começa a partir dos protocolos já emitidos (`proximoSequencialProtocolo`). |
| C3 | `aprovarDentroDaCota`: contagem e gravação na mesma transação `Serializable`. |
| C4, C5 | P2002 → 409 e P2025 → 404 no `errorHandler`; `markAsRead` lança `NotFoundError`. |
| C6 | Update do edital (cotas) dentro de `$transaction`. |
| C7 | `server`: `build` com `tsc-alias` e `start` com `NODE_ENV=production`. Raiz: `npm start` sem modo watch e novo `npm run start:prod`. |
| S1 | Express 4.19.2 → **4.22.3** (`npm audit` do server: 0 vulnerabilidades); Vite atualizado na linha 5.4. |
| S4 | Senha com mínimo de 8 caracteres, letras e números, e máximo de 72 bytes (API + cadastro). |
| S5 | Login compara contra hash fictício quando o e-mail não existe. |
| S6 | `TRUST_PROXY` configurável (`.env.example`). |
| S9 | `escaparCsv` também neutraliza `\t` e `\r` iniciais. |
| D1, D2 | Broadcast de edital com duas consultas + inserção em lote; "marcar todas" com um único `updateMany`. |
| D3 | Rotas públicas não gravam mais; encerramento por prazo num job a cada 60 s (`index.ts`); status derivado na leitura do detalhe. |
| D4 | Triagem busca todos os avaliadores numa única consulta. |
| D5 | Painel filtra avaliações e relatórios no banco (`inscricaoIds`). |
| D6 (parcial) | Editais da vitrine carregados em paralelo. Paginação e busca no banco continuam em D8. |
| D7 | Update de inscrição só cria ou remove os anexos que mudaram (o auto-save virou um único UPDATE). |
| D9 | `GET /api/notificacoes/nao-lidas` para o sino. A lista completa só carrega na página de notificações. |
| D10 | Índices `Inscricao(discenteId)`, `Inscricao(editalId, subareaCode, status)`, `Notificacao(userId, criadoEm)` e `Notificacao(referenceId, tipo)`. |
| D11 | Remoção compensatória do PDF se a gravação no banco falhar (anexos e relatórios). |
| D12 | Desligamento gracioso (`SIGTERM`/`SIGINT` → `server.close` + `prisma.$disconnect`). |
| F1 | Login e Cadastro carregados sob demanda; vendor separado em `react`, `query` e `forms`. Bundle inicial: ~400 KB → ~300 KB (~96 KB gzip). |
| A4 | `.freebuff/` removido do versionamento e adicionado ao `.gitignore`. |
| A8 (parcial) | Removidos `verifyTokenSync` e `assertSenhaForte`. A rota `/me` foi mantida porque precisa de `departamento` e `matricula`, que o guard não carrega. |
| AC1 | Gaveta mobile sobre `<dialog>` nativo: foco preso, fecha com Esc e devolve o foco. |
| AC2 | `useId()` no título do `Dialog`. |
| AC4 | Já atendido: o indicador usa `role="status"`. |
| DS1 (parcial) | Tokens `success`, `warning`, `danger` e `info` no Tailwind; 74 usos migrados em 20 arquivos. O `slate-*` (neutros) foi mantido. |
| DS2 | Badge de não lidas com a mesma cor e o mesmo limite "9+" na sidebar e no topo. |
| Extra | `GuestOnly` só redireciona para caminhos internos, mitigando o open redirect do react-router < 7.18. |

### Pendente (exige decisão da equipe ou é feature nova)

- **S3, cadastro de docente com homologação**: muda a regra de negócio e o fluxo das demos/E2E; precisa de acordo do time.
- **S2/S7/S8**: sessão em cookie httpOnly, revogação de token e recuperação de senha.
- **Dependências do web**: os avisos restantes do `npm audit` (Vite, Vitest, Tailwind, React Router) só se resolvem com versões maiores (Vite 8, Vitest 5, Tailwind 4, React Router 7). Quase todos atingem só as ferramentas de desenvolvimento, mas a migração deve ser planejada.
- **D8** (paginação), **F2** (fontes locais), **F3** (skeletons), **F4/A10** (workspaces e contratos).
- **A1–A3** (arquivar o `portal-lab` e atualizar os docs), **A5–A7** (FKs, migrations, Postgres), **A9** (logger), **A11–A13** (cobertura, auditorias no CI, banco separado para os E2E).
- **UX1–UX5**, **DS3**, **DS4**, **AC3**.
- **Aviso ao atualizar**: rode `npm run db:push --prefix server` para criar a tabela `SequenciaProtocolo` e os índices.

---

## 9. O que já está bom (manter)

- Arquitetura hexagonal com portas e adapters, repositórios in-memory para testes e `Clock` injetável.
- Regras de domínio puras (`*.rules.ts`) com testes unitários dedicados.
- Validação Zod com `.strict()` em todos os DTOs.
- Checagem de acesso que responde 404 em vez de 403 para não revelar a existência de inscrições de terceiros.
- Upload validado pela assinatura `%PDF-`, nome sanitizado e chave UUID protegida contra path traversal.
- CSP restritiva, `X-Frame-Options`, rate limit que conta apenas falhas de login.
- Protocolo com dígito verificador módulo 97.
- Front com code splitting por rota, `errorElement` por layout, `useAutoSave` com flush ao sair e aviso em `beforeunload`.
- CI com typecheck, lint (zero avisos), testes, build e E2E Playwright com upload do relatório em caso de falha.
