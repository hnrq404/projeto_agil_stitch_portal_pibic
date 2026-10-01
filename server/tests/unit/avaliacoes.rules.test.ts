import {
  assertParecer,
  assertQuantidadeAvaliadores,
  calcularNotaFinal,
  consolidar,
  LIMIAR_DIVERGENCIA,
  motivoConflito,
} from '@avaliacoes/domain/avaliacoes.rules';
import type { Avaliacao, NotaCriterio } from '@avaliacoes/domain/avaliacoes.types';
import { UnprocessableEntityError, ValidationError } from '@shared/errors/domain.errors';

function notas(merito: number, viabilidade: number, adequacao: number, formacao: number): NotaCriterio[] {
  return [
    { criterio: 'MERITO', nota: merito },
    { criterio: 'VIABILIDADE', nota: viabilidade },
    { criterio: 'ADEQUACAO', nota: adequacao },
    { criterio: 'FORMACAO', nota: formacao },
  ];
}

function avaliacao(notaFinal: number | null, status: Avaliacao['status'] = 'CONCLUIDA'): Avaliacao {
  return {
    id: `a-${Math.random()}`,
    inscricaoId: 'i1',
    avaliadorId: 'av',
    status,
    notas: [],
    notaFinal,
    parecer: '',
    atribuidaEm: new Date(),
    concluidaEm: status === 'CONCLUIDA' ? new Date() : null,
  };
}

describe('calcularNotaFinal (RF15)', () => {
  it('é a média dos critérios com duas casas', () => {
    expect(calcularNotaFinal(notas(8, 7, 9, 7))).toBe(7.75);
    expect(calcularNotaFinal(notas(10, 10, 10, 9))).toBe(9.75);
  });

  it('exige todos os critérios, sem repetição', () => {
    expect(() => calcularNotaFinal(notas(8, 7, 9, 7).slice(0, 3))).toThrow(ValidationError);
    expect(() =>
      calcularNotaFinal([...notas(8, 7, 9, 7).slice(0, 3), { criterio: 'MERITO', nota: 5 }]),
    ).toThrow(ValidationError);
  });

  it('aceita apenas inteiros de 0 a 10', () => {
    expect(() => calcularNotaFinal(notas(11, 7, 9, 7))).toThrow(/0 a 10/);
    expect(() => calcularNotaFinal(notas(-1, 7, 9, 7))).toThrow(/0 a 10/);
    expect(() => calcularNotaFinal(notas(7.5, 7, 9, 7))).toThrow(/0 a 10/);
  });
});

describe('RN07: parecer obrigatório abaixo da nota de corte', () => {
  it('dispensa parecer quando a nota atinge o corte', () => {
    expect(() => assertParecer(6, 6, '')).not.toThrow();
  });

  it('exige parecer substantivo abaixo do corte', () => {
    expect(() => assertParecer(5.75, 6, 'curto')).toThrow(/RN07/);
    expect(() => assertParecer(5.75, 6, 'Metodologia não descreve a coleta de dados.')).not.toThrow();
  });
});

describe('consolidar (RF17 / RN08)', () => {
  it('sem pareceres concluídos não há média', () => {
    expect(consolidar([avaliacao(null, 'PENDENTE')])).toMatchObject({
      total: 1,
      concluidas: 0,
      media: null,
      divergente: false,
    });
  });

  it('calcula média, extremos e ignora pendentes', () => {
    expect(consolidar([avaliacao(8), avaliacao(7), avaliacao(null, 'PENDENTE')])).toEqual({
      total: 3,
      concluidas: 2,
      media: 7.5,
      menor: 7,
      maior: 8,
      divergente: false,
    });
  });

  it(`sinaliza divergência acima de ${LIMIAR_DIVERGENCIA} pontos`, () => {
    expect(consolidar([avaliacao(9), avaliacao(5.5)]).divergente).toBe(true);
    expect(consolidar([avaliacao(9), avaliacao(6)]).divergente).toBe(false);
  });
});

describe('conflito de interesse', () => {
  const orientador = { id: 'doc', departamento: 'DCC' };

  it('bloqueia o próprio orientador e o mesmo departamento', () => {
    expect(motivoConflito({ id: 'doc', departamento: 'DCC' }, orientador, 'disc')).toMatch(/orientador/);
    expect(motivoConflito({ id: 'av', departamento: 'DCC' }, orientador, 'disc')).toMatch(/departamento/);
  });

  it('libera avaliador de outro departamento ou sem departamento', () => {
    expect(motivoConflito({ id: 'av', departamento: 'FIS' }, orientador, 'disc')).toBeNull();
    expect(motivoConflito({ id: 'av', departamento: '' }, { id: 'doc', departamento: '' }, 'disc')).toBeNull();
  });

  it('limita a 3 avaliadores por proposta', () => {
    expect(() => assertQuantidadeAvaliadores(2, 1)).not.toThrow();
    expect(() => assertQuantidadeAvaliadores(2, 2)).toThrow(UnprocessableEntityError);
  });
});
