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
| `docente@pibic.edu.br` | `docente123` | DOCENTE (DCC) | projeto divulgado com dois candidatos; avalia o projeto da Profa. Marina |
| `docente2@pibic.edu.br` | `docente123` | DOCENTE (DEMAT) | projeto em avaliação |
| `avaliador@pibic.edu.br`, `avaliador2@pibic.edu.br` | `docente123` | DOCENTE (FIS, QUI) | contas antigas de avaliador, unificadas ao docente |
| `discente@pibic.edu.br` | `discente123` | DISCENTE | bolsista com relatório mensal em atraso |
| `bruno@pibic.edu.br`, `julia@pibic.edu.br` | `discente123` | DISCENTE | candidatos ao projeto divulgado |
| `caio@pibic.edu.br` | `discente123` | DISCENTE | selecionado no projeto em avaliação |
| `visitante@pibic.edu.br` | `visitante123` | USUARIO | parte pública |

O auto-cadastro oferece só DISCENTE, DOCENTE e USUARIO. GESTOR é atribuído por um gestor em `/usuarios`. O seed também migra dados do fluxo antigo (`src/infra/migrar-legado.ts`).

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
| RN05: projeto enviado ao edital é somente leitura | `inscricoes.rules.ts` (`assertEditavel`) |
| Fluxo: rascunho → divulgado → (aluno selecionado) → em avaliação → avaliado → aprovado/recusado | `inscricoes.rules.ts` (`INSCRICAO_TRANSITIONS`) |
| Um aluno é selecionado para um só projeto por edital | `inscricoes.service.ts` (`selecionar`) |
| Envio ao edital com exatamente 3 professores avaliadores, distintos e sem o orientador | `avaliacoes.rules.ts` (`assertIndicacaoAvaliadores`, `motivoConflito`) |
| Projeto só fica AVALIADO com os 3 pareceres | `avaliacoes.rules.ts` (`avaliacaoCompleta`) |
| Relatório mensal até o dia 5 do mês seguinte (fuso do Recife), com lembrete e aviso de atraso | `projetos.rules.ts`, `projetos.service.ts` (`enviarLembretes`) |
| RN06: anexos só em PDF até 10 MB (pela assinatura `%PDF-`, não pela extensão) | `arquivo.storage.ts` |
| RN07: parecer obrigatório abaixo da nota de corte do edital | `avaliacoes.rules.ts` |
| RN08: divergência > 3 pontos entre avaliadores é sinalizada | `avaliacoes.rules.ts` (`consolidar`) |
| RN09: matrícula mascarada na exportação; CSV protegido contra injeção de fórmula | `projetos.rules.ts` |
| RN10: vitrine só mostra pesquisas aprovadas, sem e-mail nem matrícula | `publico.controller.ts` |
| RN11: acesso por papel, com troca de papel valendo na próxima requisição | `auth.middleware.ts`, `jwt.user-directory.ts` |
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
| GET | `/api/usuarios/docentes` | autenticado | professores cadastrados |

### Editais
| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| POST | `/api/editais` | gestor | cria rascunho (Σ cotas ≤ total; `notaCorte` padrão 6) |
| GET | `/api/editais?status=` | gestor | lista |
| GET/PATCH | `/api/editais/:id` | gestor | detalhe / edita (só rascunho) |
| POST | `/api/editais/:id/transicoes` | gestor | `{ acao: publicar \| encerrar }` |

### Projetos de pesquisa (recurso `inscricoes`) e candidaturas
| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| POST | `/api/inscricoes` | docente | `{ editalId }` → rascunho do projeto num edital aberto |
| GET | `/api/inscricoes/minhas` | docente | meus projetos, de qualquer status |
| GET | `/api/inscricoes/:id` | professor dono, aluno selecionado, avaliador indicado, gestor | detalhe (+ `pendencias` para o dono até o envio) |
| PATCH | `/api/inscricoes/:id` | docente dono | auto-save (rascunho ou divulgado) |
| PUT | `/api/inscricoes/:id/anexos/:tipo` | docente dono | corpo `application/pdf`, header `X-Filename`; tipo `PLANO_TRABALHO` \| `LATTES` (do aluno) |
| DELETE | `/api/inscricoes/:id/anexos/:anexoId` | docente dono | remove anexo |
| GET | `/api/inscricoes/:id/anexos/:anexoId/arquivo` | quem vê o projeto | PDF |
| POST | `/api/inscricoes/:id/divulgacao` | docente dono | divulga aos alunos (avisa todos os discentes) |
| GET | `/api/inscricoes/:id/candidaturas` | docente dono | candidatos |
| POST | `/api/inscricoes/:id/selecao` | docente dono | `{ candidaturaId }` escolhe o aluno (pode trocar até o envio) |
| POST | `/api/inscricoes/:id/submissao` | docente dono | `{ avaliadorIds: [3 professores] }` envia ao edital e gera o protocolo |
| POST | `/api/inscricoes/:id/candidaturas` | discente | `{ mensagem }` candidata-se a projeto divulgado |
| GET | `/api/candidaturas/minhas` | discente | minhas candidaturas e o andamento de cada projeto |
| DELETE | `/api/candidaturas/:id` | discente | desiste (enquanto pendente) |

### Triagem, avaliação e homologação
| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/api/triagem?editalId=&status=&subareaCode=` | gestor | fila com consolidado |
| GET | `/api/triagem/:inscricaoId` | gestor | projeto + pareceres |
| POST | `/api/triagem/:inscricaoId/avaliadores` | gestor | `{ avaliadorIds }` substitui/completa os 3 avaliadores |
| DELETE | `/api/triagem/avaliacoes/:avaliacaoId` | gestor | remove atribuição pendente |
| POST | `/api/triagem/:inscricaoId/homologacao` | gestor | `{ decisao: APROVAR \| RECUSAR, justificativa }` |
| GET | `/api/triagem/editais/:editalId/ranking` | gestor | ranking por média |
| GET | `/api/avaliadores` | docente, gestor | professores e carga pendente (para indicar avaliadores) |
| GET | `/api/avaliacoes/criterios` | autenticado | rubrica |
| GET | `/api/avaliacoes/minhas` | docente | projetos que fui indicado para avaliar |
| GET | `/api/avaliacoes/:id` | avaliador dono, gestor | avaliação + projeto |
| POST | `/api/avaliacoes/:id/parecer` | docente indicado | `{ notas: [{ criterio, nota 0..10 }], parecer }` |

### Projetos, painel, notificações e público
| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/api/projetos` | discente, docente, gestor | projetos aprovados conforme o papel |
| GET | `/api/projetos/:id` | bolsista, orientador, gestor | relatórios, calendário mensal, prazos e histórico |
| POST | `/api/projetos/:id/relatorios` | bolsista | `{ tipo: MENSAL \| FINAL, competencia?: "AAAA-MM", descricao }` |
| PUT | `/api/projetos/:id/relatorios/:relatorioId/arquivo` | bolsista | PDF opcional no mensal, obrigatório para aprovar o final |
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
