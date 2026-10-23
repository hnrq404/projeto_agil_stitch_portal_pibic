import { applicationDefault, cert, getApps, initializeApp, type AppOptions } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * Projeto usado com o emulador. O prefixo "demo-" faz o Firebase rodar sem
 * credenciais e sem nunca falar com a nuvem.
 */
export const PROJETO_DEMO = 'demo-portal-pibic';

let instancia: Firestore | undefined;

/**
 * Firestore da aplicação (singleton por processo, reaproveitado entre as
 * invocações quentes da função na Vercel).
 *
 * - Com FIRESTORE_EMULATOR_HOST: emulador local (dev, testes, CI).
 * - Sem ele: projeto real, com a conta de serviço em FIREBASE_PROJECT_ID,
 *   FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY.
 */
export function obterFirestore(env: NodeJS.ProcessEnv = process.env): Firestore {
  if (instancia) return instancia;
  const app = getApps()[0] ?? initializeApp(opcoesDoApp(env));
  instancia = getFirestore(app);
  // Campos opcionais do domínio chegam como undefined; o Firestore recusaria o documento inteiro.
  instancia.settings({ ignoreUndefinedProperties: true });
  return instancia;
}

export function opcoesDoApp(env: NodeJS.ProcessEnv): AppOptions {
  if (env['FIRESTORE_EMULATOR_HOST']) {
    return { projectId: env['FIREBASE_PROJECT_ID'] || PROJETO_DEMO };
  }
  // Na máquina local: caminho do JSON da conta de serviço, guardado fora do repositório.
  if (env['GOOGLE_APPLICATION_CREDENTIALS']) {
    return { credential: applicationDefault(), projectId: env['FIREBASE_PROJECT_ID'] };
  }
  const projectId = env['FIREBASE_PROJECT_ID'];
  const clientEmail = env['FIREBASE_CLIENT_EMAIL'];
  // Na Vercel a chave costuma ser colada com "\n" literais no lugar das quebras de linha.
  const privateKey = env['FIREBASE_PRIVATE_KEY']?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firestore sem configuração: defina FIRESTORE_EMULATOR_HOST (emulador), GOOGLE_APPLICATION_CREDENTIALS ' +
        '(caminho do JSON da conta de serviço) ou FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY.',
    );
  }
  return { credential: cert({ projectId, clientEmail, privateKey }), projectId };
}

/** Encerra as conexões (desligamento do servidor local e fim dos testes). */
export async function encerrarFirestore(): Promise<void> {
  if (!instancia) return;
  const atual = instancia;
  instancia = undefined;
  await atual.terminate();
}
