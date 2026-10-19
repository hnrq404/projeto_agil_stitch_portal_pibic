/**
 * Jest multi-project:
 *  - unit        → regras de negócio puras (rápidos)
 *  - integration → API HTTP in-memory (supertest)
 *  - e2e         → jornada completa do gestor (POST /e2e/seed limpa o estado entre testes)
 */
const makeProject = (displayName, testRegex) => ({
  displayName,
  testEnvironment: 'node',
  rootDir: '.',
  testRegex,
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }] },
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@auth/(.*)$': '<rootDir>/src/modules/auth/$1',
    '^@editais/(.*)$': '<rootDir>/src/modules/editais/$1',
    '^@notificacoes/(.*)$': '<rootDir>/src/modules/notificacoes/$1',
    '^@publico/(.*)$': '<rootDir>/src/modules/publico/$1',
    '^@inscricoes/(.*)$': '<rootDir>/src/modules/inscricoes/$1',
    '^@avaliacoes/(.*)$': '<rootDir>/src/modules/avaliacoes/$1',
    '^@projetos/(.*)$': '<rootDir>/src/modules/projetos/$1',
    '^@dashboard/(.*)$': '<rootDir>/src/modules/dashboard/$1',
  },
  clearMocks: true,
});

module.exports = {
  projects: [
    // Só tests/unit: sem isso, a regex também pegava os *.int.test.ts e eles rodavam duas vezes.
    makeProject('unit', 'tests/unit/.*\\.test\\.ts$'),
    makeProject('integration', '\\.int\\.test\\.ts$'),
    // Banco próprio (e2e.db): os E2E limpam as tabelas e não podem apagar o dev.db do seed.
    {
      ...makeProject('e2e', '\\.e2e\\.ts$'),
      globalSetup: '<rootDir>/tests/e2e/global-setup.js',
      setupFiles: ['<rootDir>/tests/e2e/setup-env.js'],
    },
  ],
};
