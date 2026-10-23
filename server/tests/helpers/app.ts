import { InMemoryArquivoStorage } from '../../src/shared/storage/arquivo.storage';
import { buildApp, type AppContainer, type AppContainerOptions } from '../../src/infra/config/app.container';

/**
 * Container dos testes de integração. Por padrão tudo em memória; com
 * TEST_PERSISTENCIA=firestore (npm run test:integration:firestore) a mesma suíte
 * roda contra o emulador, exercitando os adaptadores reais do Firestore.
 * Os PDFs ficam sempre em memória, para os testes não escreverem em disco.
 */
export function buildTestApp(options: AppContainerOptions = {}): AppContainer {
  return buildApp({
    persistencia: process.env['TEST_PERSISTENCIA'] === 'firestore' ? 'firestore' : 'memoria',
    arquivoStorage: new InMemoryArquivoStorage(),
    ...options,
  });
}
