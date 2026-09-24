# web/ — SPA Portal PIBIC (React + Vite + Tailwind)

Frontend da Sprint 2: autenticação completa (cadastro/login/JWT), painel do gestor, vitrine pública e notificações — todas as páginas navegáveis entre si.

## Rodando

```bash
npm install
npm run dev        # http://localhost:5173 (proxy /api → :3000)
npm run build      # build de produção em dist/ (servida pelo server/)
npm run test:e2e   # Playwright contra o server full-stack (:3000)
```

## Mapa de páginas (sem becos sem saída)

| Rota | Acesso | Conteúdo |
| --- | --- | --- |
| `/login` | público | Login + link "Cadastre-se" |
| `/cadastro` | público | Nome, e-mail, senha, confirmação, perfil (GESTOR/VISITANTE) |
| `/editais` | público | **Vitrine** — cards dos editais abertos + botão "Área do Gestor" |
| `/editais/:id` | público | Detalhe público do edital + voltar |
| `/gestor/editais` | GESTOR | Tabela com Ver Detalhes / Editar / Publicar + "+ Criar Novo Edital" + "Ver Vitrine Pública" |
| `/gestor/editais/novo` | GESTOR | Formulário com cotas dinâmicas e validação em tempo real |
| `/gestor/editais/:id/editar` | GESTOR | Mesmo formulário (só RASCUNHO) |
| `/gestor/editais/:id` | GESTOR | Detalhe administrativo + Publicar/Encerrar |
| `/notificacoes` | autenticado | Notificações in-app + marcar lida |
| `*` | público | 404 com links de saída |

**Redirecionamento inteligente após login:** GESTOR → `/gestor/editais`; USUARIO → `/editais`.

**Guards de rota** (`App.tsx`): `RequireAuth` (qualquer logado) e `RequireGestor` (role GESTOR; não-gestor cai na vitrine). O header global sempre mostra o estado de auth (nome + Sair, ou Entrar/Cadastrar).

**Validação de cotas em tempo real:** o formulário exibe `Soma distribuída: N de TOTAL` e bloqueia salvar quando a soma excede o total do edital (regra RN de consistência, também validada no backend).

## Estrutura

```
src/
├── auth/AuthContext.tsx   # login/register/logout + bootstrap /auth/me
├── components/Layout.tsx  # header global + estado de autenticação
├── pages/                 # 9 páginas navegáveis
├── services/api.ts        # fetch com JWT + erros tipados
└── types.ts               # tipos espelhando os DTOs da API
tests/e2e/                 # Playwright (jornada completa)
```
