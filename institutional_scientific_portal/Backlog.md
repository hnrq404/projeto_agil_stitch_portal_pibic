# Backlog — Portal de Gestão de Laboratório

> Referenciado por [[PROJECT_BRAIN]]. Fonte única do backlog priorizado — copie as linhas abaixo para o Trello (uma lista por Sprint) conforme as histórias forem entrando em andamento.
>
> **Dica de importação rápida**: no Trello, colar várias linhas de texto de uma vez no campo "Adicionar cartão" cria um cartão por linha — cole os títulos (coluna "História") e depois complete a descrição de cada card com os Critérios de Aceite correspondentes.

**Legenda de prioridade**: 🔴 Must (bloqueia a sprint) · 🟡 Should · 🟢 Could

---

## Requisitos Funcionais (RF)

| # | Requisito | Módulo | Histórias relacionadas |
|---|---|---|---|
| RF01 | Cadastrar, autenticar, encerrar sessão e recuperar senha de usuários | `auth` | S1.1 |
| RF02 | Atribuir e gerenciar papéis de usuário (admin/docente/aluno/avaliador) | `auth` | S1.2 |
| RF03 | Exibir navegação (sidebar) adaptada ao papel do usuário autenticado | `auth`, `shared` | S1.3 |
| RF04 | Proteger rotas exigindo sessão válida | `auth` | S1.4 |
| RF05 | Cadastrar edital com cotas de bolsas, prazos e subárea CNPq | `editais` | S2.1 |
| RF06 | Editar dados de um edital existente | `editais` | S2.2 |
| RF07 | Transicionar automaticamente ou manualmente o estado do edital (Ativa/Em Análise/Finalizada/Recusada) | `editais` | S2.3 |
| RF08 | Listar publicamente editais ativos com cotas restantes | `editais` | S2.4 |
| RF09 | Preencher formulário multi-etapas para submissão de proposta de pesquisa | `inscricoes` | S3.1 |
| RF10 | Anexar documentos obrigatórios (plano de trabalho, Lattes) à inscrição | `inscricoes` | S3.2 |
| RF11 | Submeter inscrição final, tornando-a somente-leitura | `inscricoes` | S3.3 |
| RF12 | Exibir detalhes e status atual de uma inscrição em tempo real | `inscricoes` | S3.4 |
| RF13 | Editar e salvar automaticamente inscrição em rascunho | `inscricoes` | S3.5 |
| RF14 | Listar inscrições pendentes de avaliação, filtráveis por status/subárea | `avaliacao` | S4.1 |
| RF15 | Avaliar inscrição por rubrica (0–10 por critério) em painel dual (PDF + rubrica) | `avaliacao` | S4.2 |
| RF16 | Registrar parecer textual justificando a nota atribuída | `avaliacao` | S4.3 |
| RF17 | Consolidar pareceres de múltiplos avaliadores para uma mesma inscrição | `avaliacao` | S4.4 |
| RF18 | Notificar aluno/orientador do resultado da avaliação | `avaliacao` | S4.5 |
| RF19 | Exibir projeto aprovado com dados de edital e orientador | `projetos` | S5.1 |
| RF20 | Submeter relatórios parciais e finais do projeto | `projetos` | S5.2 |
| RF21 | Aprovar ou solicitar correção de relatório submetido | `projetos` | S5.3 |
| RF22 | Exportar dados de projetos em CSV/PDF para prestação de contas | `projetos` | S5.4 |
| RF23 | Exibir painel de KPIs gerais (bolsas alocadas, inscrições pendentes, projetos ativos) | `dashboard` | S6.1 |
| RF24 | Exibir gráficos de cotas por edital/subárea | `dashboard` | S6.2 |
| RF25 | Exibir vitrine pública de projetos PIBIC aprovados, sem exigir login | `dashboard` | S6.3 |
| RF26 | Adaptar widgets do dashboard conforme o papel do usuário | `dashboard` | S6.4 |

## Requisitos Não Funcionais (RNF)

| # | Requisito | Categoria | Métrica / critério |
|---|---|---|---|
| RNF01 | Páginas principais (dashboard, vitrine pública) devem carregar com alta performance | Performance | Score Lighthouse ≥ 90 |
| RNF02 | Interface deve seguir diretrizes de acessibilidade | Acessibilidade | Conformidade WCAG 2.1 AA (contraste, foco visível, labels, navegação por teclado); CI falha em violação crítica/séria (axe) |
| RNF03 | Dados pessoais exportados devem preservar privacidade dos titulares | Segurança / LGPD | CPF e matrícula mascarados em exportações |
| RNF04 | Código deve ser coberto por testes automatizados que previnem regressões | Confiabilidade | Cobertura ≥ 80% em testes unitários (Vitest) nos módulos `shared`, `auth`, `editais`, `inscricoes`; 4 fluxos críticos cobertos por E2E (Playwright) no CI |
| RNF05 | Interface deve ser validada com usuários reais antes do deploy final | Usabilidade | Teste com 5–8 participantes por papel; SUS score e taxa de sucesso registrados |
| RNF06 | Código deve manter tipagem estrita e padronização automatizada | Manutenibilidade | `tsc -b --noEmit` sem erros; ESLint + Prettier obrigatórios via pre-commit e CI |
| RNF07 | Dados exibidos devem refletir mudanças no backend sem reload manual | Confiabilidade / UX | Queries reativas via Convex (status de inscrição, avaliação e dashboard atualizam em tempo real) |
| RNF08 | Alterações em formulários longos não podem ser perdidas por fechamento acidental | Disponibilidade de dados | Auto-save de inscrições em rascunho |
| RNF09 | Upload de anexos deve ser restrito a formatos e tamanhos seguros | Segurança / Compatibilidade | Apenas PDF, até 10MB por arquivo, com mensagem de erro clara para formato/tamanho inválido |
| RNF10 | Todo PR deve ser validado automaticamente antes do merge | Manutenibilidade | CI (GitHub Actions) roda lint, typecheck e testes em cada PR, bloqueando merge em caso de falha |

## Regras de Negócio (RN)

| # | Regra | Módulo | Histórias relacionadas |
|---|---|---|---|
| RN01 | Um edital em estado "Finalizada" não pode ser reaberto | `editais` | S2.3 |
| RN02 | Um edital não pode ser editado após inscrições abertas, exceto para extensão de prazo | `editais` | S2.2 |
| RN03 | Toda alteração em edital deve ficar registrada em histórico de auditoria | `editais` | S2.2 |
| RN04 | A lista pública de editais só exibe editais nos estados "Ativa" ou "Em Análise" | `editais` | S2.4 |
| RN05 | Uma inscrição submetida não pode mais ser editada pelo aluno/orientador | `inscricoes` | S3.3 |
| RN06 | Anexos de inscrição só são aceitos em PDF e até 10MB | `inscricoes` | S3.2 |
| RN07 | Parecer textual é obrigatório sempre que a nota atribuída for menor que a nota de corte do edital | `avaliacao` | S4.3 |
| RN08 | Divergência de nota entre avaliadores acima de um limiar definido deve ser sinalizada ao gestor | `avaliacao` | S4.4 |
| RN09 | CPF e matrícula devem ser mascarados em toda exportação de dados de projetos | `projetos` | S5.4 |
| RN10 | A vitrine pública só exibe projetos com status "Aprovada" | `dashboard` | S6.3 |
| RN11 | O acesso a funcionalidades é determinado exclusivamente pelo papel do usuário (admin/docente/aluno/avaliador) | `auth` | S1.2, S1.3 |
| RN12 | Acesso não autenticado a rota protegida deve redirecionar para o login; sessão expirada exige novo login | `auth` | S1.4 |

---

## S0 — Fundação (infra, `shared`)

| # | História | Critérios de aceite | Prioridade |
|---|---|---|---|
| S0.1 | Como time, quero o projeto inicializado (Vite + React + TS + Bun) para termos uma base rodável | `bun install` e `bun run dev` funcionam; estrutura de pastas por módulo (`auth/`, `editais/`, `inscricoes/`, `avaliacao/`, `projetos/`, `dashboard/`, `shared/`) criada | 🔴 |
| S0.2 | Como time, quero Convex configurado (schema inicial + auth) para termos backend/DB desde o início | `convex dev` conecta; schema vazio versionado; variáveis de ambiente documentadas no README | 🔴 |
| S0.3 | Como time, quero lint, typecheck e formatação automatizados para manter consistência de código | ESLint + Prettier configurados; `tsc -b --noEmit` sem erros; hook de pre-commit rodando os três | 🔴 |
| S0.4 | Como time, quero CI básico (GitHub Actions) rodando lint/typecheck/testes em cada PR | Workflow falha o PR se lint, typecheck ou testes quebrarem | 🔴 |
| S0.5 | Como dev, quero os design tokens de [[DESIGN]] aplicados no Tailwind config para não recriar cores/tipografia na mão | `tailwind.config` reflete cores, tipografia, spacing e radius do DESIGN.md; componentes shadcn/ui instalados e temados | 🟡 |
| S0.6 | Como dev, quero um kit de UI compartilhado (`shared/ui`) com os componentes recorrentes dos mockups (badge de status, KPI tile, stepper, dropzone) | Componentes extraídos dos 7 protótipos Stitch existem em `shared/ui` com Storybook ou página de preview | 🟡 |

## S1 — Autenticação & Navegação (`auth`, `shared`)

> Referência visual: `autentica_o_n_veis_de_acesso/`

| # | História | Critérios de aceite | Prioridade |
|---|---|---|---|
| S1.1 | Como usuário, quero me cadastrar e logar (Convex Auth) para acessar o portal | Cadastro, login, logout e recuperação de senha funcionam; erros de credencial exibem mensagem clara | 🔴 |
| S1.2 | Como admin, quero atribuir papéis (admin/docente/aluno/avaliador) a cada usuário para controlar o que cada um pode ver/fazer | Tela de gestão de usuários lista papéis; mudança de papel reflete imediatamente nas permissões | 🔴 |
| S1.3 | Como usuário autenticado, quero navegar por uma shell com sidebar adaptada ao meu papel para só ver o que me diz respeito | Sidebar mostra apenas itens permitidos por papel; rotas protegidas redirecionam usuário sem permissão | 🔴 |
| S1.4 | Como usuário, quero que rotas protegidas bloqueiem acesso direto por URL sem sessão válida | Acesso não autenticado a rota protegida redireciona para login; sessão expirada força novo login | 🔴 |

## S2 — Editais (`editais`)

| # | História | Critérios de aceite | Prioridade |
|---|---|---|---|
| S2.1 | Como gestor, quero cadastrar um edital (CNPq/PIBIC/PIBITI) com cotas e prazos para abrir inscrições | Form valida campos obrigatórios (título, cota de bolsas, prazo, subárea CNPq); edital criado aparece na listagem | 🔴 |
| S2.2 | Como gestor, quero editar um edital existente para corrigir prazos ou cotas antes do fechamento | Edição bloqueada após inscrições abertas, exceto extensão de prazo; histórico de alteração registrado | 🟡 |
| S2.3 | Como gestor, quero que o edital transite entre estados (Ativa/Em Análise/Finalizada/Recusada) automaticamente por data ou manualmente | Badge de status reflete o estado correto; transições inválidas são bloqueadas (ex.: reabrir Finalizada) | 🔴 |
| S2.4 | Como pesquisador, quero ver a lista pública de editais ativos com cotas restantes para decidir se vou me inscrever | Lista mostra apenas editais Ativa/Em Análise; cota exibida como "14/20 Bolsas Alocadas" | 🟡 |

**Status no `portal-lab` (Convex):** S2.1 a S2.4 entregues na branch `feat/S2-editais`, com notificação in-app de edital publicado e botão "Inscrever-se" integrado à S3.

- Estados implementados conforme [[Arquitetura]]: `rascunho`, `publicado` (Ativa), `em_avaliacao` (Em Análise), `encerrado` (Finalizada). O estado "Recusada" citado em S2.3 não foi implementado e aguarda decisão do time.
- Existe também uma implementação da S2 em `server/` + `web/` (Express + Prisma). A escolha da implementação oficial está pendente.

## S3 — Inscrições (`inscricoes`)

> Referência visual: `cadastro_e_edi_o_de_pesquisa/`, `detalhes_da_pesquisa_submiss_o/`

| # | História | Critérios de aceite | Prioridade |
|---|---|---|---|
| S3.1 | Como aluno/orientador, quero preencher um formulário multi-etapas para submeter uma proposta de pesquisa a um edital | Stepper com etapas salvas em rascunho; validação por etapa antes de avançar | 🔴 |
| S3.2 | Como aluno/orientador, quero anexar documentos obrigatórios (plano de trabalho, Lattes) à inscrição | Dropzone aceita apenas PDF até 10MB; barra de progresso e erro claro para formato/tamanho inválido | 🔴 |
| S3.3 | Como aluno/orientador, quero submeter a inscrição final e não poder mais editá-la depois | Botão "Submeter" exige confirmação; após submissão, formulário vira somente-leitura | 🔴 |
| S3.4 | Como aluno/orientador, quero ver os detalhes e o status da minha submissão a qualquer momento | Página de detalhes mostra dados da inscrição, anexos e status atual em tempo real (Convex reativo) | 🟡 |
| S3.5 | Como aluno/orientador, quero editar uma inscrição em rascunho antes de submeter | Alterações em rascunho persistem automaticamente (auto-save); nada é perdido ao fechar a aba | 🟢 |

## S4 — Avaliação (`avaliacao`)

> Referência visual: `central_de_triagem_de_solicita_es/`

| # | História | Critérios de aceite | Prioridade |
|---|---|---|---|
| S4.1 | Como avaliador, quero ver uma central de triagem com todas as inscrições pendentes do meu edital | Lista filtrável por status/subárea; contagem de pendentes visível | 🔴 |
| S4.2 | Como avaliador, quero abrir uma inscrição em painel dual (PDF + rubrica) para avaliar critério a critério | Preview do PDF ao lado da rubrica; rubrica com escala 0–10 por critério | 🔴 |
| S4.3 | Como avaliador, quero justificar minha nota com um parecer textual obrigatório para dar transparência à decisão | Campo de justificativa obrigatório quando nota < nota de corte; parecer salvo vinculado à inscrição | 🔴 |
| S4.4 | Como gestor, quero ver o consolidado de pareceres de uma inscrição quando houver mais de um avaliador | Média/consolidação exibida; divergência de nota acima de um limiar é sinalizada | 🟡 |
| S4.5 | Como aluno/orientador, quero ser notificado do resultado da avaliação da minha inscrição | Notificação in-app (e opcionalmente e-mail) ao mudar status para Aprovada/Recusada | 🟢 |

## S5 — Projetos & Relatórios (`projetos`)

| # | História | Critérios de aceite | Prioridade |
|---|---|---|---|
| S5.1 | Como bolsista, quero ver meu projeto aprovado com dados do edital e orientador | Página de projeto mostra vínculo edital-projeto-bolsista corretamente | 🔴 |
| S5.2 | Como bolsista, quero submeter relatórios parciais e finais do meu projeto | Upload de relatório com prazo por tipo (parcial/final); status de entrega visível ao orientador | 🔴 |
| S5.3 | Como orientador, quero aprovar ou solicitar correção de um relatório submetido | Ação de aprovar/devolver com comentário; histórico de versões do relatório mantido | 🟡 |
| S5.4 | Como gestor, quero exportar dados de projetos (CSV/PDF) para prestação de contas ao CNPq | Exportação inclui campos exigidos por edital (CPF/matrícula mascarados conforme LGPD) | 🟡 |

## S6 — Dashboard & Métricas (`dashboard`)

> Referência visual: `painel_do_gestor_m_tricas/`, `vitrine_p_blica_de_pesquisas_pibic/`

| # | História | Critérios de aceite | Prioridade |
|---|---|---|---|
| S6.1 | Como gestor, quero ver KPIs gerais (bolsas alocadas, inscrições pendentes, projetos ativos) num painel único | KPI tiles com número + comparação/delta; dados reativos via Convex | 🔴 |
| S6.2 | Como gestor, quero gráficos de cotas por edital/subárea para planejar próximos editais | Gráfico de barras/rosca com cotas usadas vs. disponíveis | 🟡 |
| S6.3 | Como visitante, quero acessar uma vitrine pública dos projetos PIBIC aprovados sem login | Página pública lista projetos aprovados com filtro por subárea/edital, sem exigir autenticação | 🟡 |
| S6.4 | Como usuário, quero que o dashboard mude de foco conforme meu papel (gestor vê tudo, aluno vê só o seu) | Mesma rota `/dashboard` renderiza widgets diferentes por papel | 🟢 |

## S7 — Qualidade & Acessibilidade (todos os módulos)

| # | História | Critérios de aceite | Prioridade |
|---|---|---|---|
| S7.1 | Como time, quero suíte de testes unitários (Vitest) cobrindo hooks e schemas Zod de cada módulo | Cobertura ≥ 80% em `shared`, `auth`, `editais`, `inscricoes` | 🔴 |
| S7.2 | Como time, quero testes E2E (Playwright) dos fluxos críticos: login, submeter inscrição, avaliar, ver dashboard | 4 fluxos críticos cobertos e rodando no CI a cada PR | 🔴 |
| S7.3 | Como time, quero auditoria de acessibilidade automatizada (axe) integrada ao CI | CI falha se houver violação WCAG AA de nível crítico/sério em páginas principais | 🟡 |
| S7.4 | Como time, quero checar performance (Lighthouse) das páginas principais | Score ≥ 90 em Performance e Acessibilidade nas páginas de dashboard e vitrine pública | 🟢 |

## S8 — Usabilidade & Polish (todos os módulos)

| # | História | Critérios de aceite | Prioridade |
|---|---|---|---|
| S8.1 | Como time, quero rodar teste de usabilidade com 5–8 participantes por papel nos fluxos principais | Roteiro de tarefas executado; SUS score e taxa de sucesso registrados | 🟡 |
| S8.2 | Como time, quero corrigir os problemas de usabilidade encontrados, priorizados por severidade | Achados críticos/altos corrigidos antes do deploy final | 🟡 |
| S8.3 | Como time, quero preparar o deploy de produção do portal | Build de produção validado; variáveis de ambiente e domínio configurados | 🔴 |

---

## Como usar este backlog

1. Cada linha é uma história pronta para virar card no Trello — título na coluna "História", descrição = "Critérios de aceite".
2. Sprints seguem a ordem de [[PROJECT_BRAIN]] §4 — não pule sprint sem fechar as histórias 🔴 (Must) da anterior.
3. Ajuste prioridades por sprint conforme a capacidade real do time (5 pessoas) — nem toda história 🟡/🟢 precisa entrar na primeira rodada daquele sprint.
