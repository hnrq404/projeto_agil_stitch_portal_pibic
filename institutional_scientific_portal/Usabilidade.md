# Usabilidade — Heurísticas de Nielsen

> Referência: Jakob Nielsen, *10 Usability Heuristics for User Interface Design* (NN/g, revisado em 2024).
> Ligado a [[PROJECT_BRAIN]], [[DESIGN]] e [[Definition-of-Done]]. O plano de testes com usuários (RNF05, S8.1/S8.2) continua neste documento na S8.

Este documento registra **como cada heurística foi aplicada** no `portal-lab` e serve de **checklist de revisão** para todo PR que mexa em interface.

---

## 1. Aplicação no portal (entregue na branch `feat/S1-heuristicas-nielsen`)

| # | Heurística | O que foi feito | Onde |
|---|---|---|---|
| 1 | Visibilidade do status do sistema | Item ativo no menu lateral (`aria-current`); trilha "Início › Página" no cabeçalho; título da aba do navegador por página; aviso fixo de pedido de perfil aguardando aprovação; spinners com texto ("Entrando no portal…", "Criando sua conta…"). | `layout/AppShell.tsx`, `layout/Sidebar.tsx`, `layout/nav.ts` |
| 2 | Correspondência com o mundo real | Removido jargão interno da UI (RBAC, RN11, RNF03, "bootstrap S1.2", códigos de sprint e caminho de arquivo na tela "em construção"). Textos em linguagem de usuário: "perfil", "aprovar pedido", "Entrar", "Criar conta". | `pages/*`, `guards.tsx` |
| 3 | Controle e liberdade do usuário | **Desfazer** após alterar/aprovar perfil; "Cancelar" + Esc + clique fora em todo diálogo; menu mobile fecha com Esc/navegação; "Voltar" na tela de acesso negado; "Digitei o e-mail errado" na recuperação de senha. | `ui/ConfirmDialog.tsx`, `pages/GestaoUsuariosPage.tsx` |
| 4 | Consistência e padrões | Links internos com `<Link>` (sem recarregar a página); um único componente `Alert` para erro/sucesso/aviso; botões seguem `btn-primary`/`btn-secondary` (cadastro deixou de usar estilo inline); vocabulário único (perfil, aprovar, entrar). | `ui/Alert.tsx`, `pages/AuthPage.tsx` |
| 5 | Prevenção de erros | Confirmação antes de alterar perfil ou assumir a gestão; alerta extra ao rebaixar o próprio perfil de gestor; validação de campo ao sair dele, com as **mesmas regras de senha do backend** (`convex/passwordRules.ts`); e-mail/nome aparados antes do envio. | `pages/AuthPage.tsx`, `convex/passwordRules.ts` |
| 6 | Reconhecer em vez de lembrar | Requisitos de senha visíveis e marcados em tempo real; descrição de cada área no topo da página; explicação de cada perfil no cadastro ("Liberado na hora" / "Precisa de aprovação"); dicas de campo (matrícula vs. SIAPE). | `pages/AuthPage.tsx`, `layout/nav.ts` |
| 7 | Flexibilidade e eficiência | Atalhos `Alt+1…9` (itens do menu) e `?` (ajuda), exibidos no `title` dos links; busca por nome/e-mail/matrícula na Gestão de Usuários; link "Pular para o conteúdo". | `layout/useKeyboardShortcuts.ts`, `pages/GestaoUsuariosPage.tsx` |
| 8 | Design estético e minimalista | Removidos da tela de entrada: números fictícios (1.420 alunos…), faixa de edital com prazo vencido (2024), botões gov.br/CAFe desabilitados, checkbox "lembrar credencial" sem função e a matriz de acessos (movida para a Ajuda). | `pages/AuthPage.tsx` |
| 9 | Reconhecer, diagnosticar e recuperar-se de erros | `friendlyError()` traduz erros do Convex/Convex Auth para pt-BR sem códigos técnicos e com próximo passo; erros exibidos junto ao campo (vermelho + ícone + `aria-invalid`); página 404 real com saídas, em vez de redirecionar em silêncio. | `lib/errors.ts`, `pages/NotFoundPage.tsx` |
| 10 | Ajuda e documentação | **Central de Ajuda** (`/ajuda`) pesquisável, com passo a passo por tarefa, tabela "o que cada perfil acessa", atalhos e contato do suporte; acessível com ou sem login; ajuda em contexto na tela de entrada. | `pages/AjudaPage.tsx` |

---

## 2. Checklist para novos PRs de interface

Copie para a descrição do PR e marque o que se aplica:

- [ ] **#1** Toda ação demorada mostra progresso e toda ação concluída mostra resultado (`Alert`).
- [ ] **#2** Nenhum código interno (RF/RN/RNF, sprint, nome de tabela) aparece para o usuário.
- [ ] **#3** Ações com efeito têm "Cancelar"; ações reversíveis oferecem "Desfazer".
- [ ] **#4** Usa `Alert`, `ConfirmDialog`, `btn-*`, `field` e `<Link>` — nada de estilos inline equivalentes.
- [ ] **#5** Ações destrutivas/irreversíveis passam por `ConfirmDialog`; regras de validação compartilhadas com o backend.
- [ ] **#6** Regras e formatos esperados estão visíveis antes do erro (dica ou checklist).
- [ ] **#7** Listas longas têm busca/filtro; novas áreas entram em `NAV_ITEMS` (ganham atalho automaticamente).
- [ ] **#8** Nada de dados fictícios, controles desabilitados sem prazo ou informação que o usuário não usa.
- [ ] **#9** Erros passam por `friendlyError()` e dizem o que fazer a seguir.
- [ ] **#10** Nova tarefa relevante ganhou tópico em `/ajuda` (array `TOPICS`).

---

## 3. Próximos passos

- S3 (Inscrição multi-etapas): indicador de etapas (#1), salvar rascunho automático e voltar etapa sem perder dados (#3/#5).
- S4 (Triagem): confirmação ao enviar parecer e edição até o prazo (#3/#5); filtros salvos (#7).
- S8: teste com 5–8 participantes por perfil (RNF05), SUS e taxa de sucesso; achados classificados por severidade usando estas heurísticas.
