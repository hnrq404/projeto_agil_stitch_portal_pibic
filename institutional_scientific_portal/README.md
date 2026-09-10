# Portal de Gestão de Laboratório

Atividade acadêmica — planejamento e documentação para o desenvolvimento de um portal institucional de gestão de laboratório (editais CNPq/PIBIC/PIBITI, inscrições de pesquisa, avaliação e relatórios).

## 👥 Equipe

- Ana Beatriz
- Arthur Uchoa
- Andre Mota Henrique Valença
- Pedro Mendes

## 📚 Documentação

- [🧠 Cérebro do Projeto](./PROJECT_BRAIN.md) — hub central, conectado por wikilinks
- [DESIGN.md](./DESIGN.md) — sistema de design (cores, tipografia, componentes, WCAG 2.1 AA)

### Wiki do Projeto (via wikilinks em `PROJECT_BRAIN.md`)
- [[Arquitetura]] — organização de código por módulos
- [[Sprints]] — planejamento S0–S8
- [[Backlog]] — user stories priorizadas
- [[Qualidade]] — testes de qualidade (unitários, integração, E2E)
- [[Usabilidade]] — testes de usabilidade (SUS, roteiros por tarefa)
- [[Definition-of-Done]] — critérios de pronto
- [[Gestao-de-Projeto]] — cerimônias ágeis e métricas

## 🛠️ Stack

TypeScript · React · Vite · Convex · Convex Auth · shadcn/ui · Tailwind CSS · Bun · Framer Motion

## 🚀 Como executar

```bash
bun install
bun run dev
```

Typecheck: `bun tsc -b --noEmit` · Convex codegen: `bun convex dev --once`
