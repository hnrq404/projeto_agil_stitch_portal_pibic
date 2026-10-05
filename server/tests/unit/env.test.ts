import { resolveJwtSecret } from '../../src/infra/config/env';

describe('resolveJwtSecret', () => {
  const forte = 'x'.repeat(48);

  it('em produção, recusa segredo ausente, de exemplo ou curto', () => {
    expect(() => resolveJwtSecret({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
    expect(() => resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'troque-em-producao' })).toThrow(/JWT_SECRET/);
    expect(() => resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'curto' })).toThrow(/JWT_SECRET/);
  });

  it('em produção, aceita segredo forte', () => {
    expect(resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: forte })).toBe(forte);
  });

  it('fora de produção, usa o segredo de desenvolvimento quando ausente', () => {
    expect(resolveJwtSecret({ NODE_ENV: 'test' })).toBe('dev-secret-change-me');
    expect(resolveJwtSecret({ NODE_ENV: 'test', JWT_SECRET: 'qualquer' })).toBe('qualquer');
  });
});
