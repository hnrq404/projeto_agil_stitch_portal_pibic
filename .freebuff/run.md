# Run doc — Portal PIBIC (portal-lab)

Aplicação: React 19 + Vite 8 + Tailwind 4 (SPA) · Backend: Convex local (sem conta Convex) · Auth: @convex-dev/auth (provedor Password).

## 1. Como reproduzir os artefatos (checkout fresco)

Todos os comandos a partir de `portal-lab/`. Requisitos: Node 20+ / npm 10+.

1. **Instalar dependências**

   ```bash
   npm install
   ```

2. **Copiar os arquivos de ambiente do checkout principal** (não versionados no git; nunca commitar segredos):

   ```bash
   cp /Users/henriquevalenca/Documents/projeto_agil_stitch_portal_pibic/portal-lab/.env.local portal-lab/.env.local
   cp /Users/henriquevalenca/Documents/projeto_agil_stitch_portal_pibic/portal-lab/convex/.env.local portal-lab/convex/.env.local
   ```

   Conteúdo esperado (valores podem variar por worktree):
   - `portal-lab/.env.local`: `VITE_CONVEX_URL` (e `VITE_CONVEX_SITE_URL`, `CONVEX_DEPLOYMENT` criados pelo CLI do Convex).
   - `portal-lab/convex/.env.local`: `AUTH_SECRET` (chave de assinatura dos tokens de sessão; gere uma nova com `openssl rand -base64 32`).

3. **Provisionar o backend local do Convex** (só na primeira vez em um checkout novo; baixa o binário local — requer internet):

   ```bash
   npx convex dev --once
   ```

   Isso cria o deployment local (`CONVEX_DEPLOYMENT=anonymous:...` em `.env.local`), aplica o schema e gera `convex/_generated/`. Não pede login Convex.

4. **Configurar as variáveis de auth no deployment local** (obrigatório; sem isso o login falha com "Missing environment variable `JWT_PRIVATE_KEY`"):

   ```bash
   echo "$(openssl rand -base64 32)" | npx convex env set AUTH_SECRET
   # JWT_PRIVATE_KEY e JWKS: par RS256 gerado exatamente como o CLI do @convex-dev/auth faz:
   node -e "const{exportJWK,exportPKCS8,generateKeyPair}=require('jose');(async()=>{const k=await generateKeyPair('RS256',{extractable:true});require('fs').writeFileSync('/tmp/jwt_private_key.txt',(await exportPKCS8(k.privateKey)).trimEnd().replace(/\\n/g,' '));require('fs').writeFileSync('/tmp/jwks.txt',JSON.stringify({keys:[{use:'sig',...(await exportJWK(k.publicKey))}]}));})();"
   cat /tmp/jwt_private_key.txt | npx convex env set JWT_PRIVATE_KEY
   cat /tmp/jwks.txt | npx convex env set JWKS
   ```

   Conferir com `npx convex env list` (deve listar AUTH_SECRET, JWT_PRIVATE_KEY e JWKS).

> Nota de arquitetura: o @convex-dev/auth exige **dois** arquivos — `convex/auth.ts` (provider Password + criação de perfil no signUp) e `convex/auth.config.ts` (verificação de JWT no backend; sem ele toda requisição autenticada retorna 401 `NoAuthProvider`).

## 2. Como rodar o servidor

```bash
npm run dev:all
```

- Frontend (Vite): http://localhost:5173
- Backend (Convex local): http://127.0.0.1:3210 (HTTP actions em :3211)
- Log do processo em background: `.freebuff/preview-8189af4d-1151-4176-a6db-0ef7a4939498.log` (quando gerenciado pelo Freebuff) ou `/tmp/fb-portal.log`.

Comandos úteis: `npm run typecheck` · `npm run lint` · `npm test` · `npm run build`.

### Como o preview é mantido vivo (launchd, macOS)

O runner do agente re processos em background, então o servidor roda sob o launchd do usuário:

```bash
launchctl submit -l fb-portal-c -- /bin/sh -c 'export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"; cd <repo>/portal-lab && npm run dev:all > /tmp/fb-portal.log 2>&1'
```

- Conferir: `launchctl print gui/$(id -u)/fb-portal-c` (campo `pid`).
- Parar: `launchctl remove fb-portal-c`.

Notas aprendidas nesta sessão:
- Scripts dentro do projeto podem ganhar xattrs (`provenance`/`decmpfs`) que fazem o launchd falhar com exit 126 ao executá-los — prefira `/bin/sh -c 'inline'`.
- `convex dev --local` está deprecado; usar `npx convex deployment select local` ou simplesmente `npx convex dev --once` (provisiona automaticamente em shells não-interativas).

## 3. Primeiro acesso (bootstrap S1.2)

1. Abra http://localhost:5173 → aba **Criar Nova Conta Institucional**.
2. Cadastre-se (senha com 8+ caracteres, maiúscula, minúscula e número). Aluno é liberado automaticamente.
3. Com a instalação sem nenhum Gestor PRPq, a shell exibe o banner **"Assumir papel de Gestor PRPq"** — o primeiro usuário autenticado assume o papel (bootstrap) e destrava a Gestão de Usuários, onde papéis elevados solicitados no cadastro entram em fila de homologação.

## 4. Sprint 3 — Inscrição de Pesquisa (M3)

Implementada em `portal-lab/` (backend `convex/inscricoes/`, frontend `src/features/inscricao/`). Fluxo validado ponta a ponta no preview: cadastro discente → edital demo → multi-etapas → upload PDF → aceite do orientador → submissão com protocolo.

### Fluxo de demonstração
1. Cadastre um **docente** (vai para fila de homologação) e um **aluno**; com o banner de bootstrap, o aluno assume Gestor PRPq e homologa o docente em **Gestão de Usuários**.
2. Como aluno: **Nova Inscrição** → se não houver edital, clique em **"Carregar edital de demonstração"** (seed idempotente — edital PIBIC 01/2026 publicado).
3. Preencha as 4 etapas (validação por etapa, auto-save com debounce de 1,5 s e indicador "Rascunho salvo"). A URL vira `/nova-inscricao/:id` ao criar o rascunho — fechar a aba não perde dados (RNF08).
4. Anexos: apenas PDF ≤ 10 MB (RN06), upload direto ao Convex Storage com barra de progresso.
5. Submissão exige orientador **aprovado** (carta-aceite) + plano de trabalho. O docente responde em **Minhas Inscrições → Solicitações de Orientação** ou no detalhe.
6. Ao submeter, o backend gera o protocolo CNPq (`23076.014821/2026-09`) e a inscrição fica somente-leitura (RN05); detalhe em `/inscricoes/:id` com timeline.

### Testes
- `npm test` — 22 unitários (Vitest): protocolo, regras de anexo/submissão, schemas Zod das etapas.
- `npm run e2e` — Playwright da jornada do discente (`e2e/discente.spec.ts`); requer o dev server rodando (`npm run dev:all`).

### Notas desta sessão (Windows)
- `BACKGROUND` não disponível no runner: `npm run dev:all` em SYNC mantém os servidores vivos até o timeout, e os processos sobrevivem (Vite :5173, Convex :3210/:3211).
- `os.tmpdir()` no Windows: usar `"$TEMP"` no shell, não `/tmp` (paths Node).
- Preview do Freebuff: registrar com `register_preview { url, pid }` usando o PID do processo que escuta :5173 (netstat).
