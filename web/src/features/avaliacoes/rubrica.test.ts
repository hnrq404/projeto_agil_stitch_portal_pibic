import { describe, expect, it } from 'vitest';

import type { CriterioId } from '@/shared/types/api';

import { mediaParcial, parecerObrigatorio, parecerValido, toNotas } from './rubrica';

const CRITERIOS: CriterioId[] = ['MERITO', 'VIABILIDADE', 'ADEQUACAO', 'FORMACAO'];

describe('rubrica', () => {
  it('só calcula a média com todos os critérios preenchidos', () => {
    expect(mediaParcial({ MERITO: 8 }, CRITERIOS)).toBeNull();
    expect(mediaParcial({ MERITO: 8, VIABILIDADE: 7, ADEQUACAO: 9, FORMACAO: 7 }, CRITERIOS)).toBe(7.75);
  });

  it('RN07: exige parecer substantivo abaixo da nota de corte', () => {
    expect(parecerObrigatorio(5.5, 6)).toBe(true);
    expect(parecerObrigatorio(6, 6)).toBe(false);
    expect(parecerObrigatorio(null, 6)).toBe(false);
    expect(parecerValido(5.5, 6, 'curto')).toBe(false);
    expect(parecerValido(5.5, 6, 'A metodologia não descreve como os dados serão coletados.')).toBe(true);
    expect(parecerValido(8, 6, '')).toBe(true);
  });

  it('serializa as notas na ordem da rubrica', () => {
    expect(toNotas({ FORMACAO: 1, MERITO: 2 }, CRITERIOS)).toEqual([
      { criterio: 'MERITO', nota: 2 },
      { criterio: 'VIABILIDADE', nota: 0 },
      { criterio: 'ADEQUACAO', nota: 0 },
      { criterio: 'FORMACAO', nota: 1 },
    ]);
  });
});
