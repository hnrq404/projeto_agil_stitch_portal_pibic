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
  },
  clearMocks: true,
});

module.exports = {
  projects: [
    makeProject('unit', '\\.test\\.ts$'),
    makeProject('integration', '\\.int\\.test\\.ts$'),
    makeProject('e2e', '\\.e2e\\.ts$'),
  ],
};
