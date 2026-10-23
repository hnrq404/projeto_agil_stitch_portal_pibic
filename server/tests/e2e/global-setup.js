/** Falha cedo, com instrução clara, se o emulador do Firestore não estiver de pé. */
module.exports = async function globalSetup() {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  try {
    await fetch(`http://${host}/`);
  } catch {
    throw new Error(
      `Emulador do Firestore não respondeu em ${host}. Rode "npm run test:e2e" (sobe o emulador sozinho) ` +
        'ou deixe "npm run emulador" aberto em outro terminal. O emulador exige Java 21+.',
    );
  }
};
