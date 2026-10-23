// Projeto próprio no emulador: a suíte apaga tudo entre os testes sem tocar nos dados de dev.
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_PROJECT_ID = 'demo-portal-pibic-integracao';
