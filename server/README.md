# server/ — API do Portal PIBIC

API Node.js + Express + TypeScript com **autenticação real** (JWT + bcrypt), **persistência real** (Prisma + SQLite; troque o datasource para PostgreSQL em produção) e PDFs gravados em disco. Cobre os módulos M1 a M7: usuários e papéis, editais, inscrições, triagem e avaliação, homologação, projetos e relatórios, painel e vitrine.

## Rodando

```bash
cp .env.example .env   # ajuste JWT_SECRET
npm install
npm run db:push        # cria/migra o SQLite (src/infra/prisma/dev.db)
npm run db:seed        # contas de demonstração e dados de exemplo (idempotente)
npm run dev            # http://localhost:3000 (API + SPA de web/dist)
```

Contas do seed (senha = papel + `123`):

| E-mail | Senha | Papel | Para testar |
| --- | --- | --- | --- |
| `gestor@pibic.edu.br` | `gestor123` | GESTOR | painel, editais, triagem, usuários |
| `docente@pibic.edu.br` | `docente123` | DOCENTE (DCC) | há um pedido de orientação aguardando resposta |
| `avaliador@pibic.edu.br` | `avaliador123` | AVALIADOR (FIS) | pareceres |
| `discente@pibic.edu.br` | `discente123` | DISCENTE | tem projeto aprovado (relatórios) e pode se inscrever no edital aberto |
| `bruno@pibic.edu.br` | `discente123` | DISCENTE | proposta submetida aguardando o orientador |
| `visitante@pibic.edu.br` | `visitante123` | USUARIO | parte pública |

O auto-cadastro oferece só DISCENTE, DOCENTE e USUARIO. GESTOR e AVALIADOR são atribuídos por um gestor em `/usuarios`.

## Arquitetura (hexagonal)

```
src/
├── shared/
│   ├── auth/          # guard JWT (recarrega o usuário a cada requisição) e RBAC por papel
│   ├── errors/        # erros de domínio → status HTTP
│   ├── events/        # porta Notifier (módulos avisam usuários sem depender do módulo de notificações)
│   ├── http/          # errorHandler, parseBody (Zod), upload de PDF (express.raw), envio de PDF
│   ├── storage/       # porta ArquivoStorage (disco | memória) + validação de PDF pela assinatura
│   └── domain/        # tabela CNPq
├── modules/           # cada módulo: domain (tipos + regras puras) · dto (Zod) · repository (porta) · service · controller
│   ├── auth/          # cadastro, login, /me, gestão de usuários
│   ├── editais/       # ciclo RASCUNHO → PUBLICADO → ENCERRADO, cotas, nota de corte
│   ├── inscricoes/    # rascunho, anexos, submissão com protocolo, vínculo com orientador
│   ├── avaliacoes/    # triagem, conflito de interesse, rubrica, consolidação, ranking, homologação
│   ├── projetos/      # relatórios com versões, prazos, histórico, CSV com matrícula mascarada
│   ├── dashboard/     # KPIs e alertas do gestor
│   ├── notificacoes/  # notificações in-app
│   └── publico/       # vitrines (editais abertos e pesquisas aprovadas), sem autenticação
└── infra/
    ├── config/        # container de DI (composition root), env
    ├── persistence/   # adapters Prisma de cada porta
    └── prisma/        # schema.prisma
```

Os services dependem só de portas (`*Repository`, `Clock`, `ArquivoStorage`, `Notifier`). Os testes injetam implementações em memória e relógio congelado; o bootstrap injeta Prisma e disco.

## Regras de negócio implementadas

| Regra | Onde |
| --- | --- |
| RN01: edital encerrado não reabre; transições válidas | `editais.rules.ts` |
| RN05: inscrição submetida é somente leitura | `inscricoes.rules.ts` (`assertEditavel`) |
| RN06: anexos só em PDF até 10 MB (pela assinatura `%PDF-`, não pela extensão) | `arquivo.storage.ts` |
| RN07: parecer obrigatório abaixo da nota de corte do edital | `avaliacoes.rules.ts` |
| RN08: divergência > 3 pontos entre avaliadores é sinalizada | `avaliacoes.rules.ts` (`consolidar`) |
| RN09: matrícula mascarada na exportação; CSV protegido contra injeção de fórmula | `projetos.rules.ts` |
| RN10: vitrine só mostra pesquisas aprovadas, sem e-mail nem matrícula | `publico.controller.ts` |
| RN11: acesso por papel, com troca de papel valendo na próxima requisição | `auth.middleware.ts`, `jwt.user-directory.ts` |
| Conflito de interesse: avaliador não pode ser o orientador nem do mesmo departamento | `avaliacoes.rules.ts` |
| Homologação não ultrapassa a cota da subárea | `inscricoes.rules.ts` (`assertCotaDisponivel`) |
| Protocolo único `23076.NNNNNN/AAAA-DV` com dígito verificador | `inscricoes.rules.ts` |

## Endpoints

Erros seguem `{ error: { code, message, details? } }`: 400 (validação), 401, 403, 404, 409, 413, 422 (regra de negócio).

### Autenticação e usuários
| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | público | `{ nome, email, senha, role: DISCENTE \| DOCENTE \| USUARIO, departamento?, matricula? }` |
| POST | `/api/auth/login` | público | `{ email, senha }` → JWT |
| GET | `/api/auth/me` | autenticado | perfil atual |
| GET | `/api/usuarios?role=` | gestor | lista |
| PATCH | `/api/usuarios/:id` | gestor | `{ role?, departamento? }` |
| GET | `/api/usuarios/docentes` | autenticado | orientadores disponíveis |

### Editais
| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| POST | `/api/editais` | gestor | cria rascunho (Σ cotas ≤ total; `notaCorte` padrão 6) |
| GET | `/api/editais?status=` | gestor | lista |
| GET/PATCH | `/api/editais/:id` | gestor | detalhe / edita (só rascunho) |
| POST | `/api/editais/:id/transicoes` | gestor | `{ acao: publicar \| encerrar }` |

### Inscrições
| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| POST | `/api/inscricoes` | discente | `{ editalId }` → rascunho (uma por edital) |
| GET | `/api/inscricoes/minhas` | discente | minhas inscrições |
| GET | `/api/inscricoes/:id` | dono, orientador, avaliador designado, gestor | detalhe (+ `pendencias` para o dono em rascunho) |
| PATCH | `/api/inscricoes/:id` | discente | auto-save do rascunho |
| PUT | `/api/inscricoes/:id/anexos/:tipo` | discente | corpo `application/pdf`, header `X-Filename`; tipo `PLANO_TRABALHO` \| `LATTES` |
| DELETE | `/api/inscricoes/:id/anexos/:anexoId` | discente | remove anexo do rascunho |
| GET | `/api/inscricoes/:id/anexos/:anexoId/arquivo` | quem vê a inscrição | PDF |
| POST | `/api/inscricoes/:id/submissao` | discente | submete e gera o protocolo |
| GET | `/api/orientacoes` | docente | inscrições em que fui indicado |
| POST | `/api/inscricoes/:id/vinculo` | orientador indicado | `{ decisao: CONFIRMAR \| RECUSAR, comentario? }` |

### Triagem, avaliação e homologação
| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/api/triagem?editalId=&status=&subareaCode=` | gestor | fila com consolidado |
| GET | `/api/triagem/:inscricaoId` | gestor | proposta + pareceres |
| POST | `/api/triagem/:inscricaoId/avaliadores` | gestor | `{ avaliadorIds }` (até 3, sem conflito) |
| DELETE | `/api/triagem/avaliacoes/:avaliacaoId` | gestor | remove atribuição pendente |
| POST | `/api/triagem/:inscricaoId/homologacao` | gestor | `{ decisao: APROVAR \| RECUSAR, justificativa }` |
| GET | `/api/triagem/editais/:editalId/ranking` | gestor | ranking por média |
| GET | `/api/avaliadores` | gestor | avaliadores e carga pendente |
| GET | `/api/avaliacoes/criterios` | autenticado | rubrica |
| GET | `/api/avaliacoes/minhas` | avaliador | atribuições |
| GET | `/api/avaliacoes/:id` | avaliador dono, gestor | avaliação + proposta |
| POST | `/api/avaliacoes/:id/parecer` | avaliador | `{ notas: [{ criterio, nota 0..10 }], parecer }` |

### Projetos, painel, notificações e público
| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/api/projetos` | discente, docente, gestor | projetos aprovados conforme o papel |
| GET | `/api/projetos/:id` | bolsista, orientador, gestor | relatórios, prazos e histórico |
| PUT | `/api/projetos/:id/relatorios/:tipo` | bolsista | PDF; tipo `PARCIAL` \| `FINAL` (final só após o parcial aprovado) |
| GET | `/api/projetos/:id/relatorios/:relatorioId/arquivo` | bolsista, orientador, gestor | PDF |
| POST | `/api/projetos/:id/relatorios/:relatorioId/avaliacao` | orientador | `{ decisao: APROVAR \| DEVOLVER, comentario }` |
| GET | `/api/projetos/exportacao.csv?editalId=` | gestor | CSV para prestação de contas |
| GET | `/api/dashboard/gestor?editalId=` | gestor | KPIs, cotas por subárea, alertas |
| GET | `/api/notificacoes` | autenticado | minhas notificações |
| PATCH | `/api/notificacoes/:id/leitura` | autenticado | marca uma como lida |
| POST | `/api/notificacoes/leitura` | autenticado | marca todas como lidas |
| GET | `/api/publico/editais`, `/api/publico/editais/:id` | público | editais abertos + bolsas alocadas |
| GET | `/api/publico/pesquisas?subareaCode=&ano=&editalId=&q=` | público | pesquisas aprovadas |
| GET | `/api/cnpq/areas` | público | tabela CNPq |
| GET | `/api/health` | público | health check |

## Testes

```bash
npm test              # unit + integração (in-memory)
npm run test:e2e      # jornada do gestor com JWT + Prisma real
```

`tests/integration/jornada.int.test.ts` cobre o ciclo S3 a S6 inteiro por HTTP. Atenção: `test:e2e` usa o mesmo `DATABASE_URL` do desenvolvimento e **limpa o banco**. Rode `npm run db:seed` depois.

## Configuração (`server/.env`, ver `.env.example`)

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="troque-em-producao"
PORT=3000
UPLOADS_DIR="uploads"
```
