# Portal de Gestão de Laboratório (Portal PIBIC)

Portal institucional para gestão do ciclo de iniciação científica: editais (CNPq/PIBIC/PIBITI), projetos de pesquisa divulgados pelos professores, candidatura e seleção de alunos, avaliação por três professores, homologação, relatórios mensais e vitrine pública de pesquisas.

**Fluxo (UNICAP):**

1. A gestão (UNICAP) abre o edital.
2. O professor escreve e divulga o projeto de pesquisa no edital.
3. Os alunos se candidatam ao projeto.
4. O professor seleciona o aluno.
5. O professor envia o projeto ao edital indicando três outros professores como avaliadores.
6. Os três professores emitem o parecer; a gestão homologa dentro da cota; o aluno é notificado do resultado.
7. O bolsista envia, todo dia 5, o relatório do que fez no mês anterior (texto, com PDF opcional) e, no fim da vigência, o relatório final em PDF.

Docente e avaliador são o mesmo papel: todo professor pode ser indicado para avaliar projetos de colegas.

Atividade acadêmica desenvolvida com metodologia ágil (Scrum/Kanban), com toda a documentação de produto e arquitetura versionada como uma wiki interna via wikilinks.

**Status atual:** aplicação full-stack cobrindo o ciclo S1 a S6, publicada na **Vercel**: API Node.js/TypeScript + Express + **Firestore** (Firebase) com autenticação real (**JWT + bcrypt**) e PDFs no **Vercel Blob**, em [`server/`](./server) e SPA **React + Vite + Tailwind** em [`web/`](./web). Três papéis principais (discente, docente, gestor); editais; projeto do professor em etapas com auto-save e upload de PDF; divulgação, candidatura e seleção do aluno; envio com três professores avaliadores; rubrica 0–10; homologação por cota; relatórios mensais (dia 5) com lembrete automático e relatório final; painel do gestor; vitrine pública. Testes unitários, de integração e E2E (API e browser) verdes. O protótipo com Convex segue em [`portal-lab/`](./portal-lab).

**Previsão de conclusão da versão funcional:** `18/11/2026`. A estimativa considera a entrega das funcionalidades principais até o fim da Sprint 4, prevista para o período de `09/11/2026` a `20/11/2026`, mantendo o limite de conclusão em novembro de 2026. Como referência de ritmo, os commits registrados entre `10/09/2026` e `21/09/2026` ocorreram ao longo de 12 dias corridos; a data permanece uma previsão e pode mudar conforme o andamento das próximas sprints. As etapas de homologação, métricas, relatórios, acessibilidade e apresentação podem ser realizadas posteriormente.

## 👥 Equipe

- Ana Pellegrino
- Artur Uchôa
- André Mota
- Henrique Valença
- Pedro Mendes

## 🚀 Rodando o projeto

A aplicação é full-stack: API em [`server/`](./server) (Express + **Firestore**) e SPA em [`web/`](./web). Em produção roda na **Vercel**, com o banco no **Firebase** e os PDFs no **Vercel Blob**. Na máquina de cada um, o banco é o **emulador do Firestore**.

Pré-requisitos: **Node 22+** e **Java 21+** (o emulador do Firebase é um programa Java; instale, por exemplo, o Temurin 21 em [adoptium.net](https://adoptium.net)).

```bash
cd caminho/para/projeto_agil_stitch_portal_pibic
cp server/.env.example server/.env      # já vem apontando para o emulador
npm run setup                           # instala as dependências do server/ e do web/
npm run dev                             # emulador (:8080) + API (:3000) + front (:5173)
```

Com o `npm run dev` rodando, em outro terminal:

```bash
npm run db:seed                         # contas e dados de demonstração
```

O emulador começa vazio a cada vez que sobe: rode o `db:seed` de novo depois de reiniciá-lo. Os PDFs enviados localmente ficam em `server/uploads/`.

Para ver o build do front servido pela própria API em `http://localhost:3000` (o emulador precisa estar rodando: `npm run emulador --prefix server`):

```bash
npm start
```

### Deploy na Vercel

O repositório já traz a configuração ([`vercel.json`](./vercel.json)): a API vira uma função serverless em [`api/index.js`](./api/index.js), o `web/dist` é servido como site estático e duas tarefas agendadas (Vercel Cron) substituem os timers do servidor local.

1. **Firebase**: crie um projeto, ative o **Firestore** (modo de produção) e publique as regras e índices deste repositório: `npx firebase deploy --only firestore --project SEU_PROJETO` (a partir de `server/`). Em *Configurações do projeto > Contas de serviço*, gere uma chave privada.
2. **Vercel**: importe o repositório (*Root Directory* = raiz). Em *Storage*, crie um **Blob store** e conecte ao projeto (isso define `BLOB_READ_WRITE_TOKEN`).
3. **Variáveis de ambiente** na Vercel: `JWT_SECRET` (32+ caracteres aleatórios), `CRON_SECRET` (aleatório), `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY` (da chave do passo 1). **Não** defina `FIRESTORE_EMULATOR_HOST` lá.
4. Faça o deploy. Para ter dados de demonstração em produção, rode o seed uma vez da sua máquina com as variáveis de produção num `.env` temporário (sem `FIRESTORE_EMULATOR_HOST`).

No plano **Hobby** as tarefas agendadas rodam uma vez por dia: editais vencidos são encerrados à meia-noite de Recife (as regras de prazo já valem pela data, então ninguém consegue se inscrever depois do prazo) e os lembretes de relatório saem às 9h. No plano Pro dá para aumentar a frequência em `vercel.json`.

No PowerShell, se `npm` for bloqueado pela política de scripts, use `npm.cmd` no lugar de `npm`.

Contas de demonstração criadas pelo seed (senha = papel + `123`):

| Perfil    | E-mail                                              | Senha          | O que dá para testar                                                                 |
| --------- | --------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------ |
| Gestor    | `gestor@pibic.edu.br`                               | `gestor123`    | painel, editais, triagem, homologação, usuários, CSV                                 |
| Docente   | `docente@pibic.edu.br`                              | `docente123`   | projeto divulgado com dois candidatos (selecionar e enviar); avaliar projeto de colega |
| Docente   | `docente2@pibic.edu.br`                             | `docente123`   | projeto em avaliação pelos três professores indicados                                |
| Docente   | `avaliador@pibic.edu.br`, `avaliador2@pibic.edu.br` | `docente123`   | contas antigas de avaliador, hoje professores: parecer pendente                      |
| Discente  | `discente@pibic.edu.br`                             | `discente123`  | bolsista com relatório mensal em atraso                                              |
| Discente  | `bruno@pibic.edu.br`, `julia@pibic.edu.br`          | `discente123`  | candidatos ao projeto divulgado; ver projetos com vaga                               |
| Visitante | `visitante@pibic.edu.br`                            | `visitante123` | parte pública, inclusive os projetos com vaga                                        |

O cadastro em `/cadastro` oferece Discente, Docente ou Visitante. O papel de Gestor é atribuído por um gestor em **Usuários**.

Detalhes, regras de negócio e endpoints em [`server/README.md`](./server/README.md); estrutura e convenções do front em [`web/README.md`](./web/README.md).

| Comando (raiz)                                        | Descrição                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `npm test`                                          | unitários + integração do server (Jest, em memória) e unitários do web (Vitest)          |
| `npm run test:firestore`                            | a suíte de integração e os E2E de API contra o emulador do Firestore (sobe sozinho)       |
| `npm run test:e2e:api`                              | E2E de API no emulador, inclusive concorrência (protocolo, cota, duplicidade)             |
| `npm run test:e2e:ui`                               | build + E2E de browser (Playwright) no emulador: ciclo completo, do edital ao relatório     |
| `npm run typecheck`                                 | `tsc` nos dois projetos                                                                   |
| `npm run lint`                                      | ESLint nos dois projetos (falha com qualquer aviso)                                         |
| `npm run format --prefix web` / `--prefix server` | formata o código com o Prettier (config em`.prettierrc.json`)                            |
| `npm run db:seed`                                   | contas e dados de demonstração (idempotente)                                              |

## 🏗️ Arquitetura

SPA **React + Vite + TypeScript** consumindo uma API REST **Express + Firestore** organizada em arquitetura hexagonal. Os mesmos papéis e regras valem no front (navegação) e no back (autorização de fato).

```text
web/ (React SPA)  ──HTTP + JWT──>  server/ (Express)
  TanStack Query                     controllers → services → portas (repositórios, storage, clock, notifier)
  react-hook-form + Zod                                        ↓
                                     adapters: Firestore · Vercel Blob (PDFs) · memória nos testes
```

- **Back-end** ([`server/`](./server)): um módulo por domínio (`auth`, `editais`, `inscricoes`, `avaliacoes`, `projetos`, `dashboard`, `notificacoes`, `publico`), cada um com regras puras testáveis, DTOs Zod, porta de repositório, service e controller. O container de DI liga as portas aos adapters do Firestore; os testes ligam a implementações em memória, e a mesma suíte também roda contra o emulador.
- **Front-end** ([`web/`](./web)): organizado por feature (`features/<módulo>` com `api.ts` de hooks e páginas), `shared/ui` com o kit do [DESIGN.md](./institutional_scientific_portal/DESIGN.md) e `app/` com rotas, guards e layouts. Páginas carregadas sob demanda.

**Papéis de acesso**: `DISCENTE`, `DOCENTE` (professor: orienta e também avalia projetos de colegas), `GESTOR`/`ADMIN` e `USUARIO` (visitante). O antigo `AVALIADOR` foi unificado ao `DOCENTE`. Toda rota da API valida o papel; o guard recarrega o usuário a cada requisição, então uma troca de papel vale na hora.

**Módulos do produto** (ver detalhes em [Arquitetura.md](./institutional_scientific_portal/Arquitetura.md)):

| Módulo                            | Responsabilidade                                                                            | Situação               |
| ---------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------ |
| M1 — Autenticação & Acesso      | Login, cadastro, papéis, guards de rota, gestão de usuários                              | ✅`server/` + `web/` |
| M2 — Edital & Publicação        | CRUD de editais, cotas por área, nota de corte, ciclo de vida                              | ✅                       |
| M3 — Projeto de Pesquisa        | Projeto do professor em etapas, auto-save, PDFs, divulgação, candidatura e seleção do aluno, protocolo | ✅                       |
| M4 — Central de Triagem           | Três professores indicados pelo orientador, rubrica 0–10, pareceres, consolidação, ranking | ✅                       |
| M5 — Painel do Gestor             | Homologação por cota, KPIs, cotas por subárea, alertas, exportação CSV                 | ✅                       |
| M6 — Vitrine Pública             | Editais abertos e pesquisas aprovadas, sem login, com filtros                               | ✅                       |
| M7 — Relatórios & Acompanhamento | Relatórios parciais/finais com versões, prazos e histórico do bolsista                   | ✅                       |

## 🎨 Mockups de design (Stitch)

Telas de referência de alta fidelidade (HTML + screenshot) usadas para guiar a implementação, uma pasta por tela:

- [`autentica_o_n_veis_de_acesso/`](./autentica_o_n_veis_de_acesso) — login e níveis de acesso
- [`cadastro_e_edi_o_de_pesquisa/`](./cadastro_e_edi_o_de_pesquisa) — inscrição de pesquisa
- [`central_de_triagem_de_solicita_es/`](./central_de_triagem_de_solicita_es) — triagem/avaliação
- [`detalhes_da_pesquisa_submiss_o/`](./detalhes_da_pesquisa_submiss_o) — detalhes da submissão
- [`painel_do_gestor_m_tricas/`](./painel_do_gestor_m_tricas) — dashboard/métricas do gestor
- [`vitrine_p_blica_de_pesquisas_pibic/`](./vitrine_p_blica_de_pesquisas_pibic) — vitrine pública
- [`pibic_logo_institucional/`](./pibic_logo_institucional) — identidade visual

O sistema de design formal (cores, tipografia, componentes, WCAG 2.1 AA) está em [DESIGN.md](./institutional_scientific_portal/DESIGN.md).

## 🗺️ Roadmap (sprints de 2 semanas)

| Sprint | Objetivo                                                            | Status                                                |
| ------ | ------------------------------------------------------------------- | ----------------------------------------------------- |
| S0     | Fundação: documentação, ferramentação, design system aprovado | ✅ Concluída                                         |
| S1     | Autenticação e níveis de acesso                                  | ✅ Concluída (sem recuperação de senha por e-mail) |
| S2     | Edital & Publicação                                               | ✅ Concluída                                         |
| S3     | Inscrição de Pesquisa                                             | ✅ Concluída                                         |
| S4     | Central de Triagem e Avaliação                                    | ✅ Concluída                                         |
| S5     | Homologação e Painel do Gestor                                    | ✅ Concluída                                         |
| S6     | Relatórios e Vitrine Pública                                      | ✅ Concluída                                         |
| S7     | Endurecimento e Acessibilidade (WCAG AA, cobertura ≥ 80%)          | ⬜ Planejada                                          |
| S8     | Release e Apresentação                                            | ⬜ Planejada                                          |

Detalhes, riscos e critérios de saída de cada sprint em [Sprints.md](./institutional_scientific_portal/Sprints.md).

## 📚 Documentação (wiki do projeto)

- [🧠 Cérebro do Projeto](./institutional_scientific_portal/PROJECT_BRAIN.md) — hub central, conectado por wikilinks
- [DESIGN.md](./institutional_scientific_portal/DESIGN.md) — sistema de design (cores, tipografia, componentes, WCAG 2.1 AA)
- [Backlog.md](./institutional_scientific_portal/Backlog.md) — requisitos funcionais (RF), não funcionais (RNF), regras de negócio (RN) e backlog priorizado
- [Sprints.md](./institutional_scientific_portal/Sprints.md) — planejamento e critérios de saída por sprint (S0–S8)
- [Arquitetura.md](./institutional_scientific_portal/Arquitetura.md) — módulos, camadas, modelo de dados Convex e convenções de código
- [Usabilidade.md](./institutional_scientific_portal/Usabilidade.md) — aplicação das 10 heurísticas de Nielsen e checklist de UI para PRs

Demais páginas da wiki (Qualidade, Definition-of-Done, Gestão de Projeto) são referenciadas via wikilinks `[[...]]` a partir do `PROJECT_BRAIN.md`.

## 🛠️ Stack

TypeScript · React 18 · Vite · TanStack Query · react-hook-form · Zod · Tailwind CSS · Express · Firestore (Firebase) · Vercel Blob · Vercel · JWT · Jest · Vitest · Playwright

## 📐 Convenções

- Commits: [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`…)
- Branches: `feat/SN-descrição` a partir de `main`
- Papéis e autorização sempre validados no backend, nunca só no frontend
- Sem `any`; `tsc --noEmit` e `npm run lint` limpos são obrigatórios antes de PR (o CI em `.github/workflows/ci.yml` roda typecheck, lint, testes, build e E2E em cada PR)
