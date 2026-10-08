# Portal de Gestão de Laboratório (Portal PIBIC)

Portal institucional para gestão do ciclo de iniciação científica: editais (CNPq/PIBIC/PIBITI), inscrição de propostas, triagem e avaliação por pareceristas, homologação, relatórios e vitrine pública de pesquisas.

Atividade acadêmica desenvolvida com metodologia ágil (Scrum/Kanban), com toda a documentação de produto e arquitetura versionada como uma wiki interna via wikilinks.

**Status atual:** aplicação full-stack cobrindo o ciclo S1 a S6: API Node.js/TypeScript + Express + **Prisma/SQLite** com autenticação real (**JWT + bcrypt**) em [`server/`](./server) e SPA **React + Vite + Tailwind** em [`web/`](./web). Quatro papéis (discente, docente, avaliador, gestor); editais; inscrição em etapas com auto-save e upload de PDF; vínculo com o orientador; triagem com conflito de interesse; rubrica 0–10; homologação por cota; relatórios com versões; painel do gestor; vitrine pública. Testes unitários, de integração e E2E (API e browser) verdes. O protótipo com Convex segue em [`portal-lab/`](./portal-lab).

**Previsão de conclusão da versão funcional:** `18/11/2026`. A estimativa considera a entrega das funcionalidades principais até o fim da Sprint 4, prevista para o período de `09/11/2026` a `20/11/2026`, mantendo o limite de conclusão em novembro de 2026. Como referência de ritmo, os commits registrados entre `10/09/2026` e `21/09/2026` ocorreram ao longo de 12 dias corridos; a data permanece uma previsão e pode mudar conforme o andamento das próximas sprints. As etapas de homologação, métricas, relatórios, acessibilidade e apresentação podem ser realizadas posteriormente.

## 👥 Equipe

- Ana Pellegrino
- Artur Uchôa
- André Mota
- Henrique Valença
- Pedro Mendes

## 🚀 Rodando o projeto

A aplicação roda full-stack em [`server/`](./server) + [`web/`](./web), usando SQLite local.

```bash
cd caminho/para/projeto_agil_stitch_portal_pibic
cp server/.env.example server/.env      # ajuste o JWT_SECRET
npm run setup                           # instala, cria o banco, aplica o seed e faz o build do web/
```

Para desenvolver com recarga automática (API em `http://localhost:3000`, front em `http://localhost:5173`):

```bash
npm run dev
```

Para ver o build do front servido pela própria API em `http://localhost:3000` (sem recarga automática, com as configurações de desenvolvimento):

```bash
npm start
```

Para rodar como em produção (API compilada para `server/dist`, `NODE_ENV=production`):

```bash
npm run start:prod
```

Em produção, o `JWT_SECRET` precisa ser aleatório e ter ao menos 32 caracteres (`openssl rand -base64 48`); com o valor de exemplo do `.env.example`, a API se recusa a subir. Atrás de um proxy reverso, defina `TRUST_PROXY=1`.

Depois de atualizar o código, rode `npm run db:push --prefix server` para aplicar mudanças do schema (tabela `SequenciaProtocolo` e índices novos).

No PowerShell, se `npm` for bloqueado pela política de scripts, use `npm.cmd` no lugar de `npm`.

Contas de demonstração criadas pelo seed (senha = papel + `123`):

| Perfil    | E-mail                     | Senha            | O que dá para testar                                               |
| --------- | -------------------------- | ---------------- | ------------------------------------------------------------------- |
| Gestor    | `gestor@pibic.edu.br`    | `gestor123`    | painel, editais, triagem, homologação, usuários, CSV             |
| Docente   | `docente@pibic.edu.br`   | `docente123`   | confirmar orientação pendente, avaliar relatórios                |
| Avaliador | `avaliador@pibic.edu.br` | `avaliador123` | rubrica de avaliação                                              |
| Discente  | `discente@pibic.edu.br`  | `discente123`  | projeto aprovado com relatórios; nova inscrição no edital aberto |
| Visitante | `visitante@pibic.edu.br` | `visitante123` | parte pública                                                      |

O cadastro em `/cadastro` oferece Discente, Docente ou Visitante. Gestor e Avaliador são atribuídos por um gestor em **Usuários**.

Detalhes, regras de negócio e endpoints em [`server/README.md`](./server/README.md); estrutura e convenções do front em [`web/README.md`](./web/README.md).

| Comando (raiz)                                        | Descrição                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `npm test`                                          | unitários + integração do server (Jest) e unitários do web (Vitest)                     |
| `npm run test:e2e:api`                              | E2E de API com JWT + Prisma real (**limpa o banco**: rode `npm run db:seed` depois) |
| `npm run test:e2e:ui`                               | build + E2E de browser (Playwright): ciclo completo com os quatro papéis                   |
| `npm run typecheck`                                 | `tsc` nos dois projetos                                                                   |
| `npm run lint`                                      | ESLint nos dois projetos (falha com qualquer aviso)                                         |
| `npm run format --prefix web` / `--prefix server` | formata o código com o Prettier (config em`.prettierrc.json`)                            |
| `npm run db:seed`                                   | contas e dados de demonstração (idempotente)                                              |

## 🏗️ Arquitetura

SPA **React + Vite + TypeScript** consumindo uma API REST **Express + Prisma** organizada em arquitetura hexagonal. Os mesmos papéis e regras valem no front (navegação) e no back (autorização de fato).

```text
web/ (React SPA)  ──HTTP + JWT──>  server/ (Express)
  TanStack Query                     controllers → services → portas (repositórios, storage, clock, notifier)
  react-hook-form + Zod                                        ↓
                                     adapters: Prisma/SQLite · PDFs em disco
```

- **Back-end** ([`server/`](./server)): um módulo por domínio (`auth`, `editais`, `inscricoes`, `avaliacoes`, `projetos`, `dashboard`, `notificacoes`, `publico`), cada um com regras puras testáveis, DTOs Zod, porta de repositório, service e controller. O container de DI liga as portas aos adapters Prisma; os testes ligam a implementações em memória.
- **Front-end** ([`web/`](./web)): organizado por feature (`features/<módulo>` com `api.ts` de hooks e páginas), `shared/ui` com o kit do [DESIGN.md](./institutional_scientific_portal/DESIGN.md) e `app/` com rotas, guards e layouts. Páginas carregadas sob demanda.

**Papéis de acesso**: `DISCENTE`, `DOCENTE` (orientador), `AVALIADOR`, `GESTOR`/`ADMIN` e `USUARIO` (visitante). Toda rota da API valida o papel; o guard recarrega o usuário a cada requisição, então uma troca de papel vale na hora.

**Módulos do produto** (ver detalhes em [Arquitetura.md](./institutional_scientific_portal/Arquitetura.md)):

| Módulo                            | Responsabilidade                                                                            | Situação               |
| ---------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------ |
| M1 — Autenticação & Acesso      | Login, cadastro, papéis, guards de rota, gestão de usuários                              | ✅`server/` + `web/` |
| M2 — Edital & Publicação        | CRUD de editais, cotas por área, nota de corte, ciclo de vida                              | ✅                       |
| M3 — Inscrição de Pesquisa      | Formulário em 5 etapas, auto-save, upload de PDF, protocolo, vínculo com orientador       | ✅                       |
| M4 — Central de Triagem           | Distribuição com conflito de interesse, rubrica 0–10, pareceres, consolidação, ranking | ✅                       |
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

TypeScript · React 18 · Vite · TanStack Query · react-hook-form · Zod · Tailwind CSS · Express · Prisma · SQLite · JWT · Jest · Vitest · Playwright

## 📐 Convenções

- Commits: [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`…)
- Branches: `feat/SN-descrição` a partir de `main`
- Papéis e autorização sempre validados no backend, nunca só no frontend
- Sem `any`; `tsc --noEmit` e `npm run lint` limpos são obrigatórios antes de PR (o CI em `.github/workflows/ci.yml` roda typecheck, lint, testes, build e E2E em cada PR)
