import fs from 'node:fs';
import path from 'node:path';

/**
 * Loader mínimo de variáveis de ambiente (server/.env) — evita dependência do
 * dotenv. Idempotente e seguro: variáveis já definidas no processo prevalecem.
 */
let loaded = false;

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
