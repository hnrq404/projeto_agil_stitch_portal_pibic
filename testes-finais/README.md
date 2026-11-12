# Testes finais

Scripts dos testes de carga, estresse, segurança e smoke do Portal PIBIC. O relatório com
os resultados e as correções está em
[Testes-Finais.md](../institutional_scientific_portal/Testes-Finais.md); as saídas brutas
de cada rodada ficam em [`resultados/`](./resultados).

> **Carga e estresse só rodam localmente.** Os scripts recusam qualquer endereço que não
> seja `localhost`: contra a Vercel, uma rajada dispara o firewall anti-DDoS (o seu IP
> passa a receber uma página de verificação) e gasta a cota diária do Firestore gratuito.

## Preparação (uma vez por sessão)

Pré-requisitos: Node 22+, Java 21+ (emulador do Firestore) e as dependências instaladas
(`npm run setup` na raiz). Na pasta `testes-finais`:

```bash
npm install
```

Em três terminais, a partir da raiz do repositório:

```bash
# 1) Banco: emulador do Firestore (porta 8080)
npm run emulador --prefix server

# 2) Build de produção da API e do site
npm run build

# 3) API compilada na porta 3100. As variáveis vazias de SMTP garantem que NENHUM
#    e-mail real sai (o server/.env pode ter o Gmail do projeto).
cd server
NODE_ENV=production PORT=3100 PERSISTENCIA=firestore FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
  FIREBASE_PROJECT_ID=demo-portal-pibic SMTP_USUARIO= SMTP_SENHA= \
  JWT_SECRET=teste-local-de-carga-com-um-segredo-bem-comprido-123456 node dist/index.js
```

No PowerShell, defina as variáveis antes com `$env:NOME = 'valor'`.

Para os testes de **segurança** e o **smoke completo**, suba a API em modo desenvolvimento,
que guarda os e-mails em memória (os scripts leem os links de confirmação em
`/api/dev/emails`) e precisa de um segredo para as tarefas agendadas:

```bash
NODE_ENV=development PORT=3100 PERSISTENCIA=firestore FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
  FIREBASE_PROJECT_ID=demo-portal-pibic SMTP_USUARIO= SMTP_SENHA= \
  CRON_SECRET=segredo-de-cron-local-para-teste \
  JWT_SECRET=teste-local-de-seguranca-com-um-segredo-bem-comprido-123 node dist/index.js
```

Antes de cada teste, zere o banco local e recrie as contas de demonstração (os contadores
do limite de tentativas ficam gravados e distorceriam a rodada seguinte):

```bash
node resetar-banco-local.mjs   # só aceita o emulador local (projeto demo-*)
```

## Os testes

| Comando | O que faz | Duração |
|---|---|---|
| `node carga.mjs` | Linha de base de 13 rotas (10 conexões) e uso misto com 10, 50 e 100 conexões | ~4 min |
| `node estresse.mjs` | Rampa até a quebra (50 → 4.800 conexões), recuperação, tempestade de logins e corpos gigantes | ~4 min |
| `node queda-do-banco.mjs --segundos=80` | Sonda a API a cada 0,5 s; derrube o emulador (Ctrl+C no terminal 1) e suba de novo durante a sonda | 80 s |
| `node seguranca.mjs` | 52 verificações: autenticação, papéis, recursos de terceiros, entradas, arquivos, links por e-mail, configuração e força bruta | ~1 min |
| `node smoke.mjs` | Caminho crítico de todos os perfis na build local | ~10 s |
| `node smoke.mjs --url=https://SEU-PROJETO.vercel.app` | Depois de um deploy: só leituras públicas, sem login (uma dúzia de requisições) | ~5 s |

Os testes de segurança usam os mesmos `JWT_SECRET` e `CRON_SECRET` da API (para forjar
tokens válidos e testar as tarefas agendadas); se usar outros valores, passe-os como
variáveis de ambiente ao rodar `seguranca.mjs`.

As suítes automatizadas do projeto completam o smoke: `npm test`, `npm run test:firestore`
e `npm run test:e2e:ui` na raiz (ver o README principal).
