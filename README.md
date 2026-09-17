# Portal de Gestão de Laboratório (Portal PIBIC)

Portal institucional para gestão do ciclo de iniciação científica: editais (CNPq/PIBIC/PIBITI), inscrição de propostas, triagem e avaliação por pareceristas, homologação, relatórios e vitrine pública de pesquisas.

Atividade acadêmica desenvolvida com metodologia ágil (Scrum/Kanban), com toda a documentação de produto e arquitetura versionada como uma wiki interna via wikilinks.

**Status atual:** Sprint 2 (Edital & Publicação — M2) implementada como API de referência em [`server/`](./server) (Node.js/TypeScript + Express + Zod + Jest, com schema Prisma/PostgreSQL em `server/src/infra/prisma/schema.prisma`): CRUD de editais com ciclo de vida, cotas por subárea CNPq, vitrine pública e notificações in-app — 69 testes verdes (unit + integração + E2E). Sprint 1 (autenticação) segue em andamento no app [`portal-lab/`](./portal-lab).

## 👥 Equipe

- Ana Beatriz
- Artur Uchôa
- Andre Mota
- Henrique Valença
- Pedro Mendes

## 🚀 Rodando o projeto

O código da aplicação vive em [`portal-lab/`](./portal-lab) (React + Vite no frontend, Convex no backend).

```bash
cd portal-lab
npm install

npm run dev:backend   # convex dev — inicia o backend/schema
npm run dev           # vite — inicia o frontend
# ou os dois juntos:
npm run dev:all
```

A API do módulo Edital & Publicação (Sprint 2) roda em [`server/`](./server) — detalhes e endpoints em [`server/README.md`](./server/README.md):

```bash
npm install --prefix server
npm test --prefix server        # unit + integration (in-memory)
npm run test:e2e --prefix server
npm run dev --prefix server     # API em http://localhost:3000
```

Outros scripts úteis (`portal-lab/package.json`):

| Script | Descrição |
| --- | --- |
| `npm run build` | typecheck + build de produção (Vite) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` / `test:watch` | Vitest (unitário/integração) |
| `npm run e2e` | Playwright (E2E) |
| `npm run format` | Prettier |

Requer uma conta/projeto [Convex](https://convex.dev) configurado (`convex dev` solicita login na primeira execução) e variáveis de ambiente do Convex Auth em `.env.local` (não versionado).

## 🏗️ Arquitetura

SPA em **React + Vite + TypeScript**, com backend **Convex** (banco reativo + funções serverless), **Convex Auth** para autenticação e **Tailwind CSS + shadcn/ui** para a UI.

```text
Cliente (React SPA) ──useQuery/useMutation──> Convex Functions ──> Banco Convex / File Storage
                     └──────────────────────> Convex Auth
```

Estrutura de pastas em `portal-lab/`:

```text
portal-lab/
├── convex/            # backend: schema, auth, roles e functions por domínio
│   └── users/         # módulo de usuários/papéis (implementado)
├── src/
│   ├── app/           # roteamento, layout (AppShell/Sidebar), guards de papel, páginas
│   ├── hooks/         # hooks transversais (useCurrentUser…)
│   ├── styles/        # design tokens / globals.css
│   └── types/         # tipos compartilhados
└── tests/             # unit, integration (Vitest) e e2e (Playwright)
```

**Papéis de acesso** (fonte única de verdade em `convex/roles.ts`): `admin` (Gestor PRPq), `docente` (Orientador), `avaliador` e `aluno`. Permissões por papel são checadas no backend (`requireRole`) e refletidas no menu lateral do frontend — nunca só no cliente.

**Módulos do produto** (ver detalhes em [Arquitetura.md](./institutional_scientific_portal/Arquitetura.md)):

| Módulo | Responsabilidade | Sprint |
| --- | --- | --- |
| M1 — Autenticação & Acesso | Login, papéis, guards de rota, shell do app | S1 *(em andamento)* |
| M2 — Edital & Publicação | CRUD de editais, cotas por área, ciclo de vida | S2 *(API de referência em `server/`)* |
| M3 — Inscrição de Pesquisa | Formulário multi-etapas, upload de plano de trabalho | S3 |
| M4 — Central de Triagem | Distribuição de propostas, rubrica 0–10, pareceres | S4 |
| M5 — Painel do Gestor | KPIs, cotas preenchidas, exportação CSV | S5 |
| M6 — Vitrine Pública | Pesquisas aprovadas, sem login, filtros por área/ano | S6 |
| M7 — Relatórios & Acompanhamento | Relatórios parciais/finais, histórico da bolsa | S6 |

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

| Sprint | Objetivo | Status |
| --- | --- | --- |
| S0 | Fundação: documentação, ferramentação, design system aprovado | ✅ Concluída |
| S1 | Autenticação e níveis de acesso | 🔵 Em andamento |
| S2 | Edital & Publicação | ✅ API de referência concluída ([`server/`](./server)) |
| S3 | Inscrição de Pesquisa | ⬜ Planejada |
| S4 | Central de Triagem e Avaliação | ⬜ Planejada |
| S5 | Homologação e Painel do Gestor | ⬜ Planejada |
| S6 | Relatórios e Vitrine Pública | ⬜ Planejada |
| S7 | Endurecimento e Acessibilidade (WCAG AA, cobertura ≥ 80%) | ⬜ Planejada |
| S8 | Release e Apresentação | ⬜ Planejada |

Detalhes, riscos e critérios de saída de cada sprint em [Sprints.md](./institutional_scientific_portal/Sprints.md).

## 📚 Documentação (wiki do projeto)

- [🧠 Cérebro do Projeto](./institutional_scientific_portal/PROJECT_BRAIN.md) — hub central, conectado por wikilinks
- [DESIGN.md](./institutional_scientific_portal/DESIGN.md) — sistema de design (cores, tipografia, componentes, WCAG 2.1 AA)
- [Backlog.md](./institutional_scientific_portal/Backlog.md) — requisitos funcionais (RF), não funcionais (RNF), regras de negócio (RN) e backlog priorizado
- [Sprints.md](./institutional_scientific_portal/Sprints.md) — planejamento e critérios de saída por sprint (S0–S8)
- [Arquitetura.md](./institutional_scientific_portal/Arquitetura.md) — módulos, camadas, modelo de dados Convex e convenções de código

Demais páginas da wiki (Qualidade, Usabilidade, Definition-of-Done, Gestão de Projeto) são referenciadas via wikilinks `[[...]]` a partir do `PROJECT_BRAIN.md`.

## 🛠️ Stack

TypeScript · React 19 · Vite · Convex · Convex Auth · react-router-dom · Tailwind CSS 4 · shadcn/ui · Zod · Vitest · Playwright

## 📐 Convenções

- Commits: [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`…)
- Branches: `feat/SN-descrição` a partir de `main`
- Papéis e autorização sempre validados no backend Convex, nunca só no frontend
- Sem `any`; `tsc --noEmit` limpo é obrigatório antes de PR
