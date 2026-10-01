# web/ — SPA do Portal PIBIC

React 18 + Vite + TypeScript + Tailwind, com TanStack Query (estado de servidor), react-hook-form + Zod (formulários) e lucide-react (ícones). Consome a API de [`server/`](../server).

## Rodando

```bash
npm install
npm run dev        # http://localhost:5173 (proxy /api → :3000; suba o server/ antes)
npm run build      # build de produção em dist/ (servida pelo server/ na :3000)
npm test           # testes unitários (Vitest)
npm run test:e2e   # Playwright contra o server full-stack (:3000), após o build
```

## Estrutura

Organização por **feature** (um módulo do produto por pasta), com uma camada `shared/` sem regra de negócio.

```
src/
├── app/                 # composição: rotas, guards de papel, navegação e layouts
│   ├── router.tsx       # mapa de rotas (páginas carregadas sob demanda)
│   ├── guards.tsx       # RequireAuth (RN12), RequireRole (RN11), GuestOnly
│   ├── navigation.ts    # menu por papel e página inicial de cada papel
│   └── layout/          # AppShell (sidebar + topo), PublicLayout
├── features/            # um módulo por pasta: api.ts (hooks de dados) + páginas
│   ├── auth/            # AuthProvider, login, cadastro
│   ├── editais/         # gestão (S2) e vitrine de editais abertos
│   ├── inscricoes/      # formulário em etapas com auto-save (S3), detalhe, orientações
│   ├── triagem/         # central de triagem, atribuição, homologação, ranking (S4/S5)
│   ├── avaliacoes/      # rubrica 0–10 em painel duplo com o PDF (S4)
│   ├── projetos/        # relatórios parciais/finais, histórico, exportação CSV (S6)
│   ├── dashboard/       # início por papel e painel do gestor (S5/S6)
│   ├── vitrine/         # pesquisas aprovadas, sem login (S6)
│   ├── notificacoes/    # lista e contador do sino
│   └── usuarios/        # gestão de papéis e departamentos (S1.2)
└── shared/
    ├── api/             # cliente HTTP (JWT, erros, upload com progresso), QueryClient
    ├── ui/              # kit de componentes do DESIGN.md (Button, Field, Card, StatusBadge...)
    ├── hooks/           # useAutoSave, useDocumentTitle
    ├── lib/             # formatadores pt-BR, rótulos de status, cn()
    └── types/api.ts     # contrato da API (espelha os DTOs do backend)
```

### Regras de dependência

- `shared/` não importa nada de `features/` nem de `app/`.
- Uma feature usa de outra apenas o que ela expõe de propósito (o `api.ts` e componentes como `PropostaConteudo`), nunca detalhes internos.
- Páginas não chamam `fetch`: todo acesso à API passa pelos hooks do `api.ts` da feature, com query keys centralizadas. Assim cache e invalidação ficam num lugar só.

### Convenções

| Tema | Como fazemos |
| --- | --- |
| Estado de servidor | TanStack Query; nada de copiar resposta da API para `useState` |
| Formulários | react-hook-form + Zod; os mínimos espelham as regras do backend, que segue sendo a autoridade |
| Erros | `ApiError` com a mensagem do backend; telas usam `ErrorState`, ações usam toast |
| Sessão | token em `localStorage`; 401 com sessão ativa dispara `session-expired` e leva ao login (RN12) |
| Permissões | menu e rotas por papel são conveniência de navegação; a autorização real é no backend |
| Estilo | só tokens do `tailwind.config.js` (cores, fontes, raios do DESIGN.md); sem cores soltas |
| Acessibilidade | `Field` liga label, dica e erro ao campo; foco visível; status sempre com texto; atalho "pular para o conteúdo" |
| Exports | componentes com named export; sem default export |

## Rotas

| Rota | Papel | Conteúdo |
| --- | --- | --- |
| `/editais`, `/editais/:id` | público | editais com inscrições abertas e bolsas alocadas |
| `/pesquisas` | público | vitrine de pesquisas aprovadas, com busca e filtros na URL |
| `/login`, `/cadastro` | público | o cadastro oferece Discente, Docente ou Visitante |
| `/inicio` | autenticado | página inicial por papel; para o gestor, o painel de indicadores |
| `/notificacoes` | autenticado | avisos com link para o item relacionado |
| `/gestor/editais...` | gestor | criar, editar (rascunho), publicar e encerrar editais |
| `/triagem`, `/triagem/:id`, `/triagem/ranking/:edital` | gestor | fila, distribuição, consolidado, homologação, ranking |
| `/usuarios` | gestor | papéis e departamentos |
| `/inscricoes`, `/inscricoes/nova`, `/inscricoes/:id/editar` | discente | inscrições e formulário em 5 etapas com auto-save |
| `/inscricoes/:id` | dono, orientador, avaliador, gestor | detalhe; o orientador confirma ou recusa o vínculo aqui |
| `/orientacoes` | docente | pedidos de orientação |
| `/avaliacoes`, `/avaliacoes/:id` | avaliador | atribuições e rubrica |
| `/projetos`, `/projetos/:id` | discente, docente, gestor | relatórios, histórico e exportação CSV |

## Testes

- **Unitários (Vitest):** regras puras do front, como a soma de cotas e a média e obrigatoriedade do parecer da rubrica.
- **E2E (Playwright):** `tests/e2e/jornada.spec.ts` percorre o ciclo inteiro com os quatro papéis: edital, inscrição, orientação, triagem, parecer, homologação e vitrine. Também verifica os guards de rota. O teste cria o próprio edital e a conta de discente, então pode rodar várias vezes.
