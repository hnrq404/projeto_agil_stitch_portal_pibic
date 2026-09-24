import { FixedClock } from '@shared/testing/fixed-clock';
import { DomainError, ValidationError, UnprocessableEntityError } from '@shared/errors/domain.errors';

import {
  assertClosable,
  assertEditable,
  assertTransition,
  assertPublishable,
  isInscricaoAberta,
  resolveAutomaticStatus,
  validateCotas,
} from '@editais/domain/editais.rules';
import type { Edital } from '@editais/domain/editais.types';

const fixedClock = new FixedClock('2026-09-14T12:00:00.000Z');

function buildEdital(overrides: Partial<Edital> = {}): Edital {
  const base: Edital = {
    id: 'edital-1',
    numero: '06/2026',
    titulo: 'Edital PIBIC 2026/2027',
    descricao: 'Programa Institucional de Bolsas de Iniciacao Cientifica',
    status: 'RASCUNHO',
    tipoBolsa: 'PIBIC',
    totalCotas: 5,
    cotas: [
      { subareaCode: '1.03', subareaNome: 'Ciencia da Computacao', quantidade: 3 },
      { subareaCode: '1.01', subareaNome: 'Matematica', quantidade: 2 },
    ],
    dataInicioInscricoes: new Date('2026-09-15T00:00:00.000Z'),
    dataFimInscricoes: new Date('2026-10-31T23:59:59.000Z'),
    publicadoEm: null,
    encerradoEm: null,
    criadoEm: new Date('2026-09-14T08:00:00.000Z'),
    atualizadoEm: new Date('2026-09-14T08:00:00.000Z'),
  };
  return { ...base, ...overrides };
}

describe('Transicoes do ciclo de vida (RN01)', () => {
  it('permite RASCUNHO -> PUBLICADO', () => {
    expect(() => assertTransition('RASCUNHO', 'PUBLICADO')).not.toThrow();
  });

  it('permite PUBLICADO -> ENCERRADO', () => {
    expect(() => assertTransition('PUBLICADO', 'ENCERRADO')).not.toThrow();
  });

  it('bloqueia saltos e retrocessos', () => {
    expect(() => assertTransition('RASCUNHO', 'ENCERRADO')).toThrow(DomainError);
    expect(() => assertTransition('PUBLICADO', 'RASCUNHO')).toThrow(DomainError);
  });

  it('bloqueia reabertura de edital ENCERRADO (estado terminal)', () => {
    expect(() => assertTransition('ENCERRADO', 'PUBLICADO')).toThrow(DomainError);
    expect(() => assertTransition('ENCERRADO', 'RASCUNHO')).toThrow(DomainError);
  });
});

describe('Regra somente RASCUNHO e editavel', () => {
  it('permite editar rascunho', () => {
    expect(() => assertEditable(buildEdital({ status: 'RASCUNHO' }))).not.toThrow();
  });

  it('bloqueia edicao de edital publicado ou encerrado', () => {
    expect(() => assertEditable(buildEdital({ status: 'PUBLICADO' }))).toThrow(UnprocessableEntityError);
    expect(() => assertEditable(buildEdital({ status: 'ENCERRADO' }))).toThrow(UnprocessableEntityError);
  });
});

describe('Regra de Consistencia de Cotas (soma <= total)', () => {
  it('aceita soma exatamente igual ao total', () => {
    expect(() =>
      validateCotas(5, [
        { subareaCode: '1.03', quantidade: 3 },
        { subareaCode: '1.01', quantidade: 2 },
      ]),
    ).not.toThrow();
  });

  it('aceita soma menor que o total', () => {
    expect(() => validateCotas(5, [{ subareaCode: '1.03', quantidade: 2 }])).not.toThrow();
  });

  it('rejeita quantidade 0 ou negativa', () => {
    expect(() => validateCotas(5, [{ subareaCode: '1.03', quantidade: 0 }])).toThrow(ValidationError);
    expect(() => validateCotas(5, [{ subareaCode: '1.03', quantidade: -1 }])).toThrow(ValidationError);
  });

  it('rejeita subarea CNPq inexistente', () => {
    expect(() => validateCotas(5, [{ subareaCode: '99.99', quantidade: 1 }])).toThrow(ValidationError);
  });

  it('bloqueia soma maior que o total', () => {
    expect(() =>
      validateCotas(5, [
        { subareaCode: '1.03', quantidade: 3 },
        { subareaCode: '1.01', quantidade: 3 },
      ]),
    ).toThrow(/ultrapassa/);
  });

  it('mescla subareas repetidas antes de somar', () => {
    expect(() =>
      validateCotas(5, [
        { subareaCode: '1.03', quantidade: 2 },
        { subareaCode: '1.03', quantidade: 2 },
      ]),
    ).not.toThrow();
  });
});

describe('Publicacao (RASCUNHO -> PUBLICADO)', () => {
  it('bloqueia publicacao sem cotas', () => {
    const edital = buildEdital({ cotas: [] });
    expect(() => assertPublishable(edital, fixedClock)).toThrow(/cotas/i);
  });

  it('bloqueia publicacao com prazo de inscricoes expirado', () => {
    const edital = buildEdital({
      dataInicioInscricoes: new Date('2025-12-01T00:00:00Z'),
      dataFimInscricoes: new Date('2026-01-01T00:00:00Z'),
    });
    expect(() => assertPublishable(edital, fixedClock)).toThrow(/expirado/);
  });

  it('bloqueia publicacao com janela incoerente (fim <= inicio)', () => {
    const edital = buildEdital({
      dataInicioInscricoes: new Date('2026-10-01T00:00:00Z'),
      dataFimInscricoes: new Date('2026-09-01T00:00:00Z'),
    });
    expect(() => assertPublishable(edital, fixedClock)).toThrow(/posterior/);
  });

  it('permite publicar edital completo e dentro do prazo', () => {
    expect(() => assertPublishable(buildEdital(), fixedClock)).not.toThrow();
  });
});

describe('Encerramento', () => {
  it('bloqueia encerrar edital ainda dentro do prazo', () => {
    const edital = buildEdital({ status: 'PUBLICADO' });
    expect(() => assertClosable(edital, fixedClock)).toThrow(/prazo/);
  });

  it('permite encerrar edital com prazo vencido', () => {
    const edital = buildEdital({ status: 'PUBLICADO' });
    fixedClock.setTo('2026-11-05T12:00:00Z');
    expect(() => assertClosable(edital, fixedClock)).not.toThrow();
    fixedClock.setTo('2026-09-14T12:00:00Z');
  });
});

describe('Encerramento automatico por prazo (S2.3)', () => {
  it('mantem PUBLICADO dentro do prazo', () => {
    const edital = buildEdital({ status: 'PUBLICADO' });
    expect(resolveAutomaticStatus(edital, fixedClock)).toBe('PUBLICADO');
  });

  it('resolve ENCERRADO apos o prazo expirar', () => {
    const edital = buildEdital({ status: 'PUBLICADO' });
    fixedClock.advanceMs(60 * 24 * 60 * 60 * 1000); // +60 dias
    expect(resolveAutomaticStatus(edital, fixedClock)).toBe('ENCERRADO');
    fixedClock.setTo('2026-09-14T12:00:00Z');
  });

  it('nunca altera RASCUNHO automaticamente', () => {
    const edital = buildEdital({ status: 'RASCUNHO' });
    fixedClock.advanceMs(365 * 24 * 60 * 60 * 1000);
    expect(resolveAutomaticStatus(edital, fixedClock)).toBe('RASCUNHO');
  });
});

describe('Janela de inscricoes abertas (listagem publica)', () => {
  it('PUBLICADO fica visivel somente dentro da janela', () => {
    const edital = buildEdital({ status: 'PUBLICADO' });
    expect(isInscricaoAberta(edital, fixedClock)).toBe(false); // antes de 15/09
    fixedClock.setTo('2026-10-01T12:00:00Z');
    expect(isInscricaoAberta(edital, fixedClock)).toBe(true);
    fixedClock.setTo('2026-11-01T12:00:00Z');
    expect(isInscricaoAberta(edital, fixedClock)).toBe(false); // apos 31/10
    fixedClock.setTo('2026-09-14T12:00:00Z');
  });

  it('RASCUNHO e ENCERRADO nunca ficam visiveis', () => {
    expect(isInscricaoAberta(buildEdital({ status: 'RASCUNHO' }), fixedClock)).toBe(false);
    expect(isInscricaoAberta(buildEdital({ status: 'ENCERRADO' }), fixedClock)).toBe(false);
  });
});
