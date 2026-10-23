/**
 * Os E2E de API rodam no emulador do Firestore, num projeto próprio: limpar as
 * coleções aqui nunca apaga os dados de desenvolvimento (projeto demo-portal-pibic).
 * Definido antes do loadEnv(), que não sobrescreve variáveis já presentes.
 */
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_PROJECT_ID = 'demo-portal-pibic-e2e';
