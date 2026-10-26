# server/ — API do Portal PIBIC

API Node.js + Express + TypeScript com **autenticação real** (JWT + bcrypt), **persistência no Firestore** (emulador no dev, Firebase em produção) e PDFs no **Vercel Blob** privado (em disco no dev). Roda como servidor Node comum ou como função serverless da Vercel. Cobre os módulos M1 a M7: usuários e papéis, editais, inscrições, triagem e avaliação, homologação, projetos e relatórios, painel e vitrine.

## Rodando

```bash
cp .env.example .env   # já aponta para o emulador
npm install
npm run emulador       # Firestore local em 127.0.0.1:8080 (exige Java 21+); deixe aberto
npm run db:seed        # em outro terminal: contas e dados de exemplo (idempotente)
npm run dev            # http://localhost:3000 (API + SPA de web/dist)
```

Contas do seed (senha = papel + `123`):

| E-mail | Senha | Papel | Para testar |
| --- | --- | --- | --- |
| `gestor.demo@unicap.br` | `gestor123` | GESTOR | painel, editais, triagem, usuários |
| `docente.demo@unicap.br` | `docente123` | DOCENTE (DCC) | projeto divulgado com dois candidatos; avalia o projeto da Profa. Marina |
| `docente2.demo@unicap.br` | `docente123` | DOCENTE (DEMAT) | projeto em avaliação |
| `avaliador.demo@unicap.br`, `avaliador2.demo@unicap.br` | `docente123` | DOCENTE (FIS, QUI) | professores com parecer pendente |
| `discente.demo@unicap.br` | `discente123` | DISCENTE | bolsista com relatório mensal em atraso |
| `bruno.demo@unicap.br`, `julia.demo@unicap.br` | `discente123` | DISCENTE | candidatos ao projeto divulgado |
| `caio.demo@unicap.br` | `discente123` | DISCENTE | selecionado no projeto em avaliação |
| `visitante.demo@unicap.br` | `visitante123` | USUARIO | parte pública |

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
    ├── config/        # container de DI (composition root), env, rotas de cron
    └── firestore/     # adapters Firestore de cada porta + contador do limite de tentativas
```

Os services dependem só de portas (`*Repository`, `Clock`, `ArquivoStorage`, `Notifier`). Os testes injetam implementações em memória e relógio congelado; o bootstrap injeta Firestore e Vercel Blob (ou disco no dev).

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

Erros seguem `{ error: { code, message, details? } }`: 400 (validação), 401, 403, 404, 409, 413, 422 (regra de negócio), 429 (limite de tentativas). Nos 500, `error.requestId` traz o mesmo id do header `X-Request-Id` e da linha de log.

### Autenticação e usuários
| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | público | `{ nome, email (@unicap.br), senha, role: DISCENTE \| DOCENTE \| USUARIO, departamento?, matricula? }` → conta **pendente** + link de confirmação por e-mail; aluno recebe `envioCurriculo` para o Lattes |
| PUT | `/api/auth/cadastro/curriculo` | público (chave do cadastro) | `{ usuarioId, chave, nome }`: Lattes enviado logo após o cadastro, enquanto a conta está pendente |
| POST | `/api/auth/verificar-email` | público | `{ token }` do link → confirma a conta e devolve o JWT |
| POST | `/api/auth/reenviar-verificacao` | público | `{ email }` → novo link (resposta igual para qualquer e-mail) |
| POST | `/api/auth/esqueci-senha` | público | `{ email }` → link de redefinição, válido por 1 hora |
| POST | `/api/auth/redefinir-senha` | público | `{ token, novaSenha }` → troca a senha, encerra as outras sessões e devolve o JWT |
| POST | `/api/auth/login` | público | `{ email, senha }` → JWT; 403 `EMAIL_NAO_CONFIRMADO` se a conta ainda não foi confirmada |
| GET | `/api/auth/me` | autenticado | perfil atual |
| POST | `/api/auth/senha` | autenticado | `{ senhaAtual, novaSenha }` → JWT novo; tokens anteriores deixam de valer |
| POST | `/api/perfil/curriculo/envio` · PUT `/api/perfil/curriculo` · GET `/api/perfil/curriculo` | aluno | troca e abre o próprio Lattes |
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
| POST | `/api/inscricoes/:id/anexos/PLANO_TRABALHO/envio` | docente dono | autoriza o envio do plano de trabalho (o Lattes vem do perfil do aluno e é copiado para o projeto no envio ao edital) |
| PUT | `/api/inscricoes/:id/anexos/:tipo` | docente dono | `{ chave, nome }`: confere o PDF recebido (tamanho, `%PDF-`) e o registra |
| DELETE | `/api/inscricoes/:id/anexos/:anexoId` | docente dono | remove anexo |
| GET | `/api/inscricoes/:id/anexos/:anexoId/arquivo` | quem vê o projeto | `{ nome, url }`: link que expira em 5 min |
| GET | `/api/inscricoes/:id/candidaturas/:candidaturaId/curriculo` | docente dono | `{ nome, url }`: Lattes do candidato |
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
| POST | `/api/projetos/:id/relatorios/:relatorioId/arquivo/envio` | bolsista | autoriza o envio do PDF (opcional no mensal, obrigatório para aprovar o final) |
| PUT | `/api/projetos/:id/relatorios/:relatorioId/arquivo` | bolsista | `{ chave, nome }`: confere o PDF recebido e o anexa |
| GET | `/api/projetos/:id/relatorios/:relatorioId/arquivo` | bolsista, orientador, gestor | `{ nome, url }`: link que expira em 5 min |
| POST | `/api/projetos/:id/relatorios/:relatorioId/avaliacao` | orientador | `{ decisao: APROVAR \| DEVOLVER, comentario }` |
| GET | `/api/projetos/exportacao.csv?editalId=` | gestor | CSV para prestação de contas |
| GET | `/api/dashboard/gestor?editalId=` | gestor | KPIs, cotas por subárea, alertas |
| GET | `/api/notificacoes` | autenticado | minhas notificações |
| PATCH | `/api/notificacoes/:id/leitura` | autenticado | marca uma como lida |
| POST | `/api/notificacoes/leitura` | autenticado | marca todas como lidas |
| GET | `/api/publico/editais`, `/api/publico/editais/:id` | público | editais abertos + bolsas alocadas |
| GET | `/api/publico/pesquisas?subareaCode=&ano=&editalId=&q=` | público | pesquisas aprovadas |
| GET | `/api/cnpq/areas` | público | tabela CNPq |
| GET | `/api/health` | público | liveness (o processo responde) |
| GET | `/api/health/ready` | público | readiness (o banco responde); 503 se não |
| GET | `/api/cron/encerrar-editais`, `/api/cron/lembretes-relatorio` | Vercel Cron (`CRON_SECRET`) | tarefas agendadas |
| GET | `/api/auditoria?entidade=&entidadeId=&actorId=&limite=` | gestor | trilha de auditoria, mais recentes primeiro (padrão 50, máx. 200) |

## Testes

```bash
npm test                           # unit + integração (em memória, sem Java)
npm run test:integration:firestore # a mesma integração contra o emulador do Firestore
npm run test:e2e                   # E2E com JWT real no emulador, inclusive concorrência
```

Os comandos com emulador sobem e derrubam o Firestore sozinhos (`firebase emulators:exec`) e usam projetos próprios (`demo-portal-pibic-integracao`, `demo-portal-pibic-e2e`): limpar os dados ali nunca apaga o que está no emulador de desenvolvimento.

`tests/integration/jornada.int.test.ts` cobre o ciclo S3 a S6 inteiro por HTTP. `tests/e2e/concorrencia.firestore.e2e.ts` confere, com acessos simultâneos, que o protocolo não se repete, a cota não estoura e e-mail e candidatura não duplicam.

## Banco de dados: Firestore

Cada agregado é um documento (o edital leva as cotas; a inscrição, os anexos; a avaliação, as notas). Decisões que valem para qualquer mudança futura:

- **Consultas por um campo só, filtro e ordenação em memória.** Assim nenhuma consulta exige índice composto, que o emulador não cobra e faria a produção falhar. A única exceção, notificações não lidas por usuário, está declarada em [`firestore.indexes.json`](../firestore.indexes.json).
- **Unicidade por documento-índice.** O Firestore não tem UNIQUE: e-mail, número de edital, candidatura (projeto + aluno) e versão de relatório têm uma coleção `*_unicos` cujo id é a chave única, criada na mesma escrita. Conflito vira 409.
- **Transações onde há disputa**: sequência do protocolo, aprovação dentro da cota (todas as aprovações da subárea passam por uma mesma trava) e contador de tentativas de login.
- **Regras de segurança fechadas** ([`firestore.rules`](../firestore.rules)): só a API, com o `firebase-admin`, lê e grava.
- Não há migrações: campo novo nasce opcional no tipo de domínio e o adapter preenche o padrão na leitura.

Publicar regras e índices no projeto real: `npx firebase deploy --only firestore --project SEU_PROJETO`.

## PDFs: envio direto ao armazenamento

A Vercel limita o corpo das funções a 4,5 MB, e o limite do portal é 10 MB, então o PDF não passa pela API:

1. `POST .../envio`: a API confere a permissão e devolve uma chave e a instrução de envio (token do Vercel Blob restrito àquele caminho, a PDF e a 10 MB, válido por 15 min).
2. O navegador envia o arquivo direto ao Blob (store **privado**).
3. `PUT ...` com `{ chave, nome }`: a API confere tamanho e assinatura `%PDF-`, apaga o arquivo se for recusado e registra o anexo. A chave só vale para a inscrição (ou relatório) e o tipo para os quais foi emitida.

A leitura devolve uma URL pré-assinada que expira em 5 minutos, emitida depois da checagem de permissão. Sem `BLOB_READ_WRITE_TOKEN` (dev e testes), o mesmo fluxo usa rotas da própria API (`/api/arquivos/...`) com links assinados por HMAC.

## Tarefas agendadas

No servidor local, timers do `index.ts` encerram editais vencidos (a cada minuto) e enviam lembretes de relatório (de hora em hora). Na Vercel não há processo contínuo: a Vercel Cron chama `GET /api/cron/encerrar-editais` e `GET /api/cron/lembretes-relatorio` com `Authorization: Bearer <CRON_SECRET>` (horários em [`vercel.json`](../vercel.json)).

## Observabilidade

- Cada requisição da API gera uma linha JSON no stdout: `requestId`, método, rota (sem query string), status, duração e id do usuário. Desligado com `NODE_ENV=test`.
- O `X-Request-Id` de um proxy é reaproveitado se tiver formato seguro; senão, a API gera um.
- `/api/health` é o liveness e `/api/health/ready` o readiness (consulta o banco).

## Configuração (`server/.env`, ver `.env.example`)

| Variável | Dev local | Produção (Vercel) |
| --- | --- | --- |
| `FIRESTORE_EMULATOR_HOST` | `127.0.0.1:8080` | não definir |
| `FIREBASE_PROJECT_ID` | `demo-portal-pibic` | id do projeto Firebase |
| `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | não precisa | da conta de serviço |
| `JWT_SECRET` | qualquer valor | 32+ caracteres aleatórios (obrigatório) |
| `BLOB_READ_WRITE_TOKEN` | não precisa (PDFs em `UPLOADS_DIR`) | definido ao conectar o Blob store |
| `CRON_SECRET` | não precisa | valor aleatório |
| `PERSISTENCIA` | `memoria` sobe sem banco | não definir |
