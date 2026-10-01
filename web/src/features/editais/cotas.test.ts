import { describe, expect, it } from 'vitest';

import { mensagemCotas, resumoCotas } from './cotas';

describe('resumoCotas', () => {
  it('soma as cotas e calcula o restante', () => {
    const r = resumoCotas(5, [
      { subareaCode: '1.03', quantidade: 2 },
      { subareaCode: '1.01', quantidade: '1' },
    ]);
    expect(r).toMatchObject({ soma: 3, restante: 2, excede: false, completa: false, duplicadas: [] });
    expect(mensagemCotas(5, r)).toContain('restam 2');
  });

  it('sinaliza distribuição completa e excesso', () => {
    expect(resumoCotas(3, [{ subareaCode: '1.03', quantidade: 3 }]).completa).toBe(true);
    const excesso = resumoCotas(3, [{ subareaCode: '1.03', quantidade: 4 }]);
    expect(excesso.excede).toBe(true);
    expect(mensagemCotas(3, excesso)).toContain('EXCEDE');
  });

  it('detecta subáreas repetidas e ignora linhas sem subárea', () => {
    const r = resumoCotas(10, [
      { subareaCode: '1.03', quantidade: 1 },
      { subareaCode: '1.03', quantidade: 1 },
      { subareaCode: '', quantidade: 1 },
      { subareaCode: '', quantidade: 1 },
    ]);
    expect(r.duplicadas).toEqual(['1.03']);
  });

  it('trata quantidades vazias como zero', () => {
    expect(resumoCotas(4, [{ subareaCode: '1.03', quantidade: '' }]).soma).toBe(0);
  });
});
