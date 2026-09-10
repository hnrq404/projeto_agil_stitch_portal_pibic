# 🧠 Cérebro do Projeto — Portal de Gestão de Laboratório

> Hub central de navegação do projeto. Todos os documentos são conectados por **wikilinks** (`[[...]]`).
> Estilo visual definido em [[DESIGN]] — Corporate / Modern Institutional (WCAG 2.1 AA).

---

## 1. Visão Geral do Produto

- **Produto**: Portal institucional de gestão de laboratório — gestão de editais (CNPq/PIBIC/PIBITI), inscrições de pesquisa, avaliação de pareceristas, cotas de bolsas e relatórios.
- **Público**: pesquisadores, docentes, avaliadores de fomento e alunos de iniciação científica.
- **Pilares**: rigor institucional, clareza científica, acessibilidade (WCAG 2.1 AA), densidade informacional controlada.
- **Stack**: TypeScript, React, Vite, Convex (backend/database), Convex Auth, shadcn/ui, Tailwind CSS, Bun, Framer Motion.

### Documentos do Projeto
- [[DESIGN]] — Sistema de design (cores, tipografia, spacing, componentes)
- [[Arquitetura]] — Estrutura de módulos e organização de código
- [[Sprints]] — Planejamento de sprints (resumo abaixo)
- [[Backlog]] — Backlog priorizado de user stories
- [[Qualidade]] — Estratégia de testes de qualidade
- [[Usabilidade]] — Plano de testes de usabilidade
- [[Definition-of-Done]] — Critérios de pronto por entrega
- [[Gestao-de-Projeto]] — Cerimônias, ritos e métricas ágeis

---

## 2. Organização do Código por Módulos

Cada módulo é autônomo (componentes + hooks + schemas + testes co-localizados), facilitando manutenção e onboarding:

| Módulo | Responsabilidade | Documento |
|---|---|---|
| `auth` | Login, sessão, papéis (admin/docente/aluno/avaliador) | [[Modulo-Auth]] |
| `editais` | CRUD de editais, cotas, prazos, publicações | [[Modulo-Editais]] |
| `inscricoes` | Formulário multi-etapas, anexos, submissão | [[Modulo-Inscricoes]] |
| `avaliacao` | Triagem, rubrica de critérios, pareceres | [[Modulo-Avaliacao]] |
| `projetos` | Projetos aprovados, relatórios, produtos científicos | [[Modulo-Projetos]] |
| `dashboard` | KPIs, métricas, visões por papel | [[Modulo-Dashboard]] |
| `shared` | UI kit, formatadores (CPF/Datas), tipos comuns | [[Modulo-Shared]] |

**Convenções**: componentes funcionais + hooks puros; schemas Convex como fonte única de verdade; validação com Zod; imports absolutos; um commit = um objetivo.

---

## 3. Boas Práticas de Programação

- **Clean Code**: funções pequenas, nomes explícitos, evitar aninhamento profundo.
- **Tipagem estrita**: `tsc -b --noEmit` sem erros obrigatório; nenhum `any`.
- **Testes**: unitários (Vitest), de integração (Convex mock) e E2E (Playwright) — detalhes em [[Qualidade]].
- **Revisão**: PR pequenos (< 400 linhas), checklist em [[Definition-of-Done]].
- **Versionamento**: Conventional Commits (`feat:`, `fix:`, `chore:`), branches `feat/`, `fix/`.
- **Acessibilidade**: contraste AA, foco visível, labels em todos os campos, navegação por teclado.
- **Estado**: queries reativas Convex; evitar duplicar estado de servidor no cliente.

---

## 4. Planejamento de Sprints

Sprints de **2 semanas**. Fluxo detalhado e critérios por sprint em [[Sprints]].

| Sprint | Foco | Entregas principais | Módulos |
|---|---|---|---|
| **S0** (Sprint 0) | Fundação | Setup repo, CI, lint, estrutura de módulos, design tokens | infra, `shared` |
| **S1** | Autenticação & Navegação | Login/registro, papéis, rotas protegidas, shell com sidebar | `auth`, `shared` |
| **S2** | Editais | CRUD de editais, cotas, estados (Ativa/Em Análise/Finalizada/Recusada) | `editais` |
| **S3** | Inscrições | Formulário multi-etapas, stepper, upload de anexos, submissão | `inscricoes` |
| **S4** | Avaliação | Triagem dual-pane, rubrica 0–10, pareceres com justificativa | `avaliacao` |
| **S5** | Projetos & Relatórios | Projetos aprovados, relatórios parciais/finais, exportação | `projetos` |
| **S6** | Dashboard & Métricas | KPI tiles, gráficos de cotas, visões por papel | `dashboard` |
| **S7** | Qualidade & Acessibilidade | Cobertura de testes ≥ 80%, auditoria WCAG AA, correções | todos |
| **S8** | Usabilidade & Polish | Testes de usabilidade, refinamento visual, performance, deploy | todos |

Cada sprint fecha com: review + demo, retrospectiva e atualização de [[Backlog]].

---

## 5. Qualidade e Usabilidade

- **Testes de qualidade** ([[Qualidade]]): unitários, integração, E2E, lint, typecheck, auditoria de acessibilidade (axe/WAVE), testes de performance (Lighthouse ≥ 90).
- **Testes de usabilidade** ([[Usabilidade]]): 5–8 participantes por papel, roteiros por tarefa (submeter inscrição, avaliar projeto), métricas SUS e taxa de sucesso, ciclo de correção por severidade.

---

## 6. Gestão de Projeto

- **Metodologia**: Scrum Kanban híbrido — cerimônias em [[Gestao-de-Projeto]].
- **Métricas**: velocity, burndown, lead time de PR, cobertura de testes, dívida técnica.
- **Riscos**: mudanças de requisitos de editais → mitigação com schemas versionados; dívida de acessibilidade → auditoria por sprint.
