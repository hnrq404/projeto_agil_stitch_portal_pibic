import {
  assertCotaDisponivel,
  assertEditavel,
  assertInscricaoTransition,
  gerarProtocolo,
  pendenciasParaSubmissao,
  protocoloValido,
} from '@inscricoes/domain/inscricoes.rules';
import type { Inscricao } from '@inscricoes/domain/inscricoes.types';
import type { Edital } from '@editais/domain/editais.types';
import { UnprocessableEntityError } from '@shared/errors/domain.errors';

const edital: Edital = {
  id: 'edital-1',
  numero: '06/2026',
  titulo: 'Edital PIBIC 2026/2027',
  descricao: '',
  status: 'PUBLICADO',
  tipoBolsa: 'PIBIC',
  totalCotas: 3,
  cotas: [
    { subareaCode: '1.03', subareaNome: 'Ciência da Computação', quantidade: 2 },
    { subareaCode: '1.01', subareaNome: 'Matemática', quantidade: 1 },
  ],
  notaCorte: 6,
  dataInicioInscricoes: new Date('2026-09-01T00:00:00.000Z'),
  dataFimInscricoes: new Date('2026-10-31T23:59:59.000Z'),
  publicadoEm: new Date('2026-09-01T00:00:00.000Z'),
  encerradoEm: null,
  criadoEm: new Date('2026-08-30T00:00:00.000Z'),
  atualizadoEm: new Date('2026-08-30T00:00:00.000Z'),
};

function inscricaoCompleta(overrides: Partial<Inscricao> = {}): Inscricao {
  const agora = new Date('2026-09-14T12:00:00.000Z');
  return {
    id: 'insc-1',
    protocolo: null,
    editalId: edital.id,
    discenteId: 'discente-1',
    orientadorId: 'docente-1',
    titulo: 'Redes neurais para tomografia pulmonar',
    subareaCode: '1.03',
    subareaNome: 'Ciência da Computação',
    palavrasChave: 'aprendizado profundo; saúde',
    resumo: 'R'.repeat(120),
    objetivos: 'O'.repeat(60),
    metodologia: 'M'.repeat(60),
    status: 'RASCUNHO',
    vinculoStatus: null,
    vinculoComentario: null,
    anexos: [
      { id: 'a1', tipo: 'PLANO_TRABALHO', storageKey: 'k1', nome: 'plano.pdf', tamanho: 10, mimeType: 'application/pdf', enviadoEm: agora },
      { id: 'a2', tipo: 'LATTES', storageKey: 'k2', nome: 'lattes.pdf', tamanho: 10, mimeType: 'application/pdf', enviadoEm: agora },
    ],
    homologacaoJustificativa: null,
    submetidaEm: null,
    homologadaEm: null,
    criadoEm: agora,
    atualizadoEm: agora,
    ...overrides,
  };
}

describe('protocolo', () => {
  it('gera no formato 23076.NNNNNN/AAAA-DV e valida o dígito verificador', () => {
    const protocolo = gerarProtocolo(14821, 2026);
    expect(protocolo).toMatch(/^23076\.014821\/2026-\d{2}$/);
    expect(protocoloValido(protocolo)).toBe(true);
  });

  it('detecta protocolo com dígito alterado', () => {
    const protocolo = gerarProtocolo(1, 2026);
    const adulterado = protocolo.replace('000001', '000002');
    expect(protocoloValido(adulterado)).toBe(false);
  });

  it('protocolos distintos para sequenciais distintos', () => {
    expect(gerarProtocolo(1, 2026)).not.toBe(gerarProtocolo(2, 2026));
  });

  it('rejeita sequencial fora do intervalo', () => {
    expect(() => gerarProtocolo(0, 2026)).toThrow(RangeError);
    expect(() => gerarProtocolo(1_000_000, 2026)).toThrow(RangeError);
  });
});

describe('pendenciasParaSubmissao', () => {
  it('inscrição completa não tem pendências', () => {
    expect(pendenciasParaSubmissao(inscricaoCompleta(), edital)).toEqual([]);
  });

  it('lista cada item faltante (rascunho vazio)', () => {
    const vazia = inscricaoCompleta({
      titulo: '',
      subareaCode: '',
      resumo: '',
      objetivos: '',
      metodologia: '',
      orientadorId: null,
      anexos: [],
    });
    const pendencias = pendenciasParaSubmissao(vazia, edital);
    expect(pendencias).toHaveLength(8);
    expect(pendencias.join(' ')).toContain('orientador');
    expect(pendencias.join(' ')).toContain('plano de trabalho');
    expect(pendencias.join(' ')).toContain('currículo lattes');
  });

  it('exige subárea com cota no edital', () => {
    const pendencias = pendenciasParaSubmissao(inscricaoCompleta({ subareaCode: '2.04' }), edital);
    expect(pendencias).toEqual(['A subárea escolhida não tem cotas neste edital.']);
  });
});

describe('ciclo de vida', () => {
  it('RN05: só o rascunho é editável', () => {
    expect(() => assertEditavel(inscricaoCompleta())).not.toThrow();
    expect(() => assertEditavel(inscricaoCompleta({ status: 'SUBMETIDA' }))).toThrow(
      UnprocessableEntityError,
    );
  });

  it('permite o fluxo feliz e a devolução ao rascunho pela recusa do orientador', () => {
    expect(() => assertInscricaoTransition('RASCUNHO', 'SUBMETIDA')).not.toThrow();
    expect(() => assertInscricaoTransition('SUBMETIDA', 'RASCUNHO')).not.toThrow();
    expect(() => assertInscricaoTransition('SUBMETIDA', 'EM_AVALIACAO')).not.toThrow();
    expect(() => assertInscricaoTransition('AVALIADA', 'APROVADA')).not.toThrow();
  });

  it('bloqueia saltos e estados terminais', () => {
    expect(() => assertInscricaoTransition('RASCUNHO', 'APROVADA')).toThrow(UnprocessableEntityError);
    expect(() => assertInscricaoTransition('APROVADA', 'RECUSADA')).toThrow(UnprocessableEntityError);
    expect(() => assertInscricaoTransition('RECUSADA', 'AVALIADA')).toThrow(UnprocessableEntityError);
  });
});

describe('assertCotaDisponivel (homologação)', () => {
  it('aprova enquanto houver cota na subárea', () => {
    expect(() => assertCotaDisponivel(edital, '1.03', 1)).not.toThrow();
  });

  it('bloqueia quando a cota da subárea está esgotada', () => {
    expect(() => assertCotaDisponivel(edital, '1.01', 1)).toThrow(/Cota esgotada/);
  });

  it('bloqueia subárea sem cota no edital', () => {
    expect(() => assertCotaDisponivel(edital, '2.04', 0)).toThrow(UnprocessableEntityError);
  });
});
