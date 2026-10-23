import { encerrarFirestore } from '../../src/infra/firestore/firestore.client';

/** Cada teste começa com o banco vazio, como acontece com os repositórios em memória. */
beforeEach(async () => {
  const host = process.env['FIRESTORE_EMULATOR_HOST'];
  const projeto = process.env['FIREBASE_PROJECT_ID'];
  // Endpoint do emulador que apaga todos os documentos do projeto de uma vez.
  const res = await fetch(`http://${host}/emulator/v1/projects/${projeto}/databases/(default)/documents`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Não foi possível limpar o emulador (${res.status}).`);
});

afterAll(() => encerrarFirestore());
