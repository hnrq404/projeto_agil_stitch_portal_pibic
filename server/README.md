# server/ — API Edital & Publicação (Sprint 2 · M2)

Implementação de referência do módulo **M2 — Edital & Publicação**: CRUD de editais com ciclo de vida, cotas por subárea CNPq, vitrine pública e notificações in-app.

> **Nota de arquitetura:** o backend de produção do portal é Convex (`portal-lab/`). Este serviço REST isola o domínio M2 atrás de portas/repositórios (`Clock`, `EditaisRepository`, `NotificacoesRepository`, `UserDirectory`, `EventPublisher`), de modo que a lógica de negócio é portável para qualquer persistência — inclusive Prisma/PostgreSQL (schema em `src/infra/prisma/schema.prisma`) ou funções Convex.

## Rodando

```bash
npm install
npm run dev            # tsx watch — http://localhost:3000
npm test               # unit + integration (in-memory, sem banco)
npm run test:e2e       # jornada completa do gestor
npm run typecheck
```

## Ciclo de vida do edital

```
RASCUNHO ──publish──> PUBLICADO ──close/expira──> ENCERRADO
```

- Somente `RASCUNHO` é editável (`PATCH /api/editais/:id` → 422 caso contrário).
- Publicar exige: numero/titulo, ≥ 1 cota, Σ cotas ≤ totalCotas, janela de inscrições coerente e futura.
- `GET /api/publico/editais` retorna apenas `PUBLICADO` com prazo vigente (encerrados automaticamente por relógio).
- Publicar dispara notificação in-app para todos os usuários (RF07).

## Endpoints

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| POST | `/api/editais` | Bearer GESTOR | Cria edital (RASCUNHO) com cotas |
| GET | `/api/editais` | Bearer GESTOR | Lista (filtro `?status=`) |
| GET | `/api/editais/:id` | Bearer GESTOR | Detalhe |
| PATCH | `/api/editais/:id` | Bearer GESTOR | Atualiza (só RASCUNHO) |
| POST | `/api/editais/:id/publicar` | Bearer GESTOR | PUBLICADO + notificações |
| POST | `/api/editais/:id/encerrar` | Bearer GESTOR | ENCERRADO |
| GET | `/api/notificacoes` | Bearer | Notificações do usuário |
| GET | `/api/publico/editais` | — | Vitrine pública (vigentes) |
| POST | `/e2e/seed` | — | Reset do estado (usado pelos testes E2E) |

Erros seguem `{ error: { code, message, details? } }` — `400` schema (Zod), `401/403` auth/RBAC, `404` não encontrado, `409` conflito de transição, `422` regra de negócio.

## Autenticação (stub da Sprint 1)

`Authorization: Bearer <token>` com usuários seed em `src/infra/auth/seed.users.ts`:

| Token | Papel |
| --- | --- |
| `gestor-token` | GESTOR |
| `avaliador-token` | AVALIADOR |
| `docente-token` | DOCENTE |
| `discente-token` | DISCENTE |

## Estrutura

```
src/
├── shared/            # erros de domínio, tabela CNPq, auth/RBAC, middlewares, Clock
├── modules/
│   ├── editais/       # domain (regras puras) · dto (Zod) · repository · service · controller
│   ├── notificacoes/  # domain · repository · service · controller
│   └── publico/       # vitrine pública
├── infra/             # container DI, seed de usuários, schema Prisma
└── index.ts           # bootstrap
tests/
├── unit/              # regras de negócio puras + service de notificações
├── integration/       # API HTTP via supertest (auth, RBAC, CRUD, erros)
└── e2e/               # jornada do gestor: criar → cotas → publicar → vitrine → encerrar
```

## Exemplo: criar e publicar

```bash
curl -X POST http://localhost:3000/api/editais \
  -H "Authorization: Bearer gestor-token" -H "Content-Type: application/json" \
  -d '{
    "numero": "01/2026", "titulo": "PIBIC 2026-2027",
    "totalCotas": 10,
    "cotas": [
      { "subareaCode": "1.03", "quantidade": 4 },
      { "subareaCode": "2.02", "quantidade": 6 }
    ],
    "dataInicioInscricoes": "2026-10-01T00:00:00.000Z",
    "dataFimInscricoes": "2026-11-01T00:00:00.000Z"
  }'

curl -X POST http://localhost:3000/api/editais/<id>/publicar \
  -H "Authorization: Bearer gestor-token"
```
