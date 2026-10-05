import fs from 'node:fs';
import path from 'node:path';

/**
 * Loader mínimo de variáveis de ambiente (server/.env) — evita dependência do
 * dotenv. Idempotente e seguro: variáveis já definidas no processo prevalecem.
 */
let loaded = false;

const DEV_JWT_SECRET = 'dev-secret-change-me';
const PLACEHOLDER_SECRETS = new Set([DEV_JWT_SECRET, 'troque-em-producao']);
const MIN_PRODUCTION_SECRET_LENGTH = 32;

/**
 * Segredo de assinatura do JWT. Em produção é obrigatório e forte: sem ele,
 * qualquer pessoa poderia gerar um token de gestor com o segredo padrão.
 */
export function resolveJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env['JWT_SECRET']?.trim();

  if (env['NODE_ENV'] === 'production') {
    if (!secret || PLACEHOLDER_SECRETS.has(secret) || secret.length < MIN_PRODUCTION_SECRET_LENGTH) {
      throw new Error(
        `JWT_SECRET ausente ou fraco. Em produção, defina um valor aleatório com ao menos ${MIN_PRODUCTION_SECRET_LENGTH} caracteres (ex.: openssl rand -base64 48).`,
      );
    }
    return secret;
  }

  if (!secret) {
    if (env['NODE_ENV'] !== 'test') {
      console.warn('[portal-pibic-server] JWT_SECRET não definido: usando o segredo de desenvolvimento.');
    }
    return DEV_JWT_SECRET;
  }
  return secret;
}

export function loadEnv(): void {
  if (loaded) return;
  loaded = true;

  // src/infra/config → server/.env (rootDir preservado no build dist/).
  const envPath = path.resolve(__dirname, '..', '..', '..', '.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
