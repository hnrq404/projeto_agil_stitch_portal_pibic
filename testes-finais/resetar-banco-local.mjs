// Apaga todos os dados do EMULADOR local do Firestore e roda o seed de novo.
// Usado entre rodadas dos testes (os contadores do limite de tentativas ficam gravados no banco).
// Recusa qualquer coisa que não seja o emulador em 127.0.0.1/localhost.
import { execSync } from 'node:child_process';
import path from 'node:path';

import { PASTA } from './lib.mjs';

const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const projeto = process.env.FIREBASE_PROJECT_ID ?? 'demo-portal-pibic';
if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host) || !projeto.startsWith('demo-')) {
  console.error(`Recusado: ${host} / ${projeto} não é o emulador local de demonstração.`);
  process.exit(2);
}

const r = await fetch(`http://${host}/emulator/v1/projects/${projeto}/databases/(default)/documents`, { method: 'DELETE' });
if (!r.ok) throw new Error(`Falha ao limpar o emulador: HTTP ${r.status}`);
console.log('Emulador limpo.');

execSync('npm run db:seed', {
  cwd: path.join(PASTA, '..', 'server'),
  stdio: 'inherit',
  env: {
    ...process.env,
    PERSISTENCIA: 'firestore',
    FIRESTORE_EMULATOR_HOST: host,
    FIREBASE_PROJECT_ID: projeto,
    // Nunca usar o SMTP real do server/.env durante os testes.
    SMTP_USUARIO: '',
    SMTP_SENHA: '',
  },
});
