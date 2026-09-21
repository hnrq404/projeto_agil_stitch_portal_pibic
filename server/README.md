# server/ — API Edital & Publicação + Auth (Sprint 2 · M2)

Backend do módulo **M2 — Edital & Publicação** com **autenticação real** (JWT + bcrypt) e **persistência real** (Prisma + SQLite — troque o datasource para PostgreSQL em produção).

## Rodando

```bash
npm install
npm run db:push     # cria/migra o SQLite (server/src/infra/prisma/dev.db)
npm run db:seed     # contas de demonstração + edital de exemplo
npm run dev         # http://localhost:3000 (API + SPA de web/dist)
```

Contas do seed:

| E-mail | Senha | Papel |
| --- | --- | --- |
| `gestor@pibic.edu.br` | `gestor123` | GESTOR |
| `visitante@pibic.edu.br` | `visitante123` | USUARIO |

## Arquitetura (hexagonal)

```
src/
├── shared/            # erros de domínio, tabela CNPq, guards (RBAC), Clock
├── modules/
│   ├── auth/          # domain · dto (Zod) · repository (porta) · service (JWT/bcrypt) · controller
│   ├── editais/       # domain (regras puras) · dto · repository · service · controller
│   ├── notificacoes/  # domain · repository · service · controller
│   └── publico/       # vitrine pública
├── infra/
│   ├── config/        # container DI, env loader
│   ├── persistence/   # adapters Prisma (Usuario, Edital, CotaSubarea, Notificacao)
│   └── prisma/        # schema.prisma + dev.db
└── index.ts           # bootstrap: env, Prisma, API + SPA
```

As portas (`Clock`, `EditaisRepository`, `NotificacoesRepository`, `UsuariosRepository`, `UserDirectory`) mantêm o domínio independente de framework — os testes injetam in-memory + clock congelado; o bootstrap injeta Prisma.

## Endpoints

### Auth (público)
| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/api/auth/register` | `{ nome, email, senha, role: GESTOR \| USUARIO }` → 201 + JWT |
| POST | `/api/auth/login` | `{ email, senha }` → 200 + JWT |
| GET | `/api/auth/me` | Perfil do portador do token |

### Editais (Bearer + RBAC GESTOR)
| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/api/editais` | Cria RASCUNHO com cotas (Σ cotas ≤ totalCotas) |
| GET | `/api/editais?status=` | Lista administrativa |
| GET | `/api/editais/:id` | Detalhe |
| PATCH | `/api/editais/:id` | Edita (somente RASCUNHO → 422) |
| POST | `/api/editais/:id/transicoes` | `{ acao: "publicar" \| "encerrar" }` |
| POST | `/api/editais/:id/publicar` | Alias RESTful de publicar |

### Demais
| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| GET | `/api/publico/editais` | — | Vitrine (PUBLICADO + prazo vigente) |
| GET | `/api/cnpq/areas` | — | Tabela CNPq para selects |
| GET | `/api/notificacoes` | Bearer | Minhas notificações |
| PATCH | `/api/notificacoes/:id/leitura` | Bearer | Marcar lida |
| GET | `/api/health` | — | Health check |

Erros: `{ error: { code, message, details? } }` — 400 (Zod), 401 (JWT), 403 (RBAC), 404, 409 (conflito), 422 (regra de negócio).

## Testes

```bash
npm test              # unit + integração (in-memory, 90 testes)
npm run test:e2e      # jornada completa com JWT + Prisma real (SQLite)
```

## Configuração (server/.env)

```env
DATABASE_URL="file:./dev.db"   # relativo a src/infra/prisma/
JWT_SECRET="troque-em-producao"
PORT=3000
# USE_PRISMA=false              # roda in-memory (sem banco)
```
