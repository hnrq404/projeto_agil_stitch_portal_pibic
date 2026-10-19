import {
  acompanhamento,
  assertCompetenciaEnviavel,
  assertDescricao,
  competenciaDe,
  competenciasDaVigencia,
  gerarCsv,
  mascararMatricula,
  nomeCompetencia,
  prazoFinal,
  prazoMensal,
  proximaVersao,
  situacaoRelatorio,
} from '@projetos/domain/projetos.rules';
import type { Relatorio, RelatorioStatus, RelatorioTipo } from '@projetos/domain/projetos.types';

function relatorio(tipo: RelatorioTipo, competencia: string, versao: number, status: RelatorioStatus): Relatorio {
  return {
    id: `${tipo}-${competencia}-${versao}`,
    inscricaoId: 'p1',
    tipo,
    competencia,
    versao,
    status,
    descricao: 'Atividades do mês.',
    arquivo: null,
    comentarioOrientador: null,
    enviadoEm: new Date('2026-12-01T00:00:00.000Z'),
    avaliadoEm: null,
  };
}

describe('relatório mensal: todo dia 5, no fuso do Recife', () => {
  it('o mês de referência segue o horário do Recife (UTC-3)', () => {
    // 1º de outubro às 01h UTC ainda é 30 de setembro no Recife.
    expect(competenciaDe(new Date('2026-10-01T01:00:00.000Z'))).toBe('2026-09');
    expect(competenciaDe(new Date('2026-10-01T03:00:00.000Z'))).toBe('2026-10');
  });

  it('o relatório de um mês vence no dia 5 do mês seguinte, 23:59 no Recife', () => {
    expect(prazoMensal('2026-09').toISOString()).toBe('2026-10-06T02:59:59.999Z');
    expect(prazoMensal('2026-12').toISOString()).toBe('2027-01-06T02:59:59.999Z');
  });

  it('a vigência tem 12 meses a partir do mês da homologação', () => {
    const meses = competenciasDaVigencia(new Date('2026-11-20T15:00:00.000Z'));
    expect(meses).toHaveLength(12);
    expect(meses[0]).toBe('2026-11');
    expect(meses[11]).toBe('2027-10');
    expect(nomeCompetencia('2027-03')).toBe('março/2027');
  });

  it('aceita o mês corrente e os anteriores da vigência, nunca meses futuros', () => {
    const homologadaEm = new Date('2026-09-10T12:00:00.000Z');
    const agora = new Date('2026-11-02T12:00:00.000Z');
    expect(() => assertCompetenciaEnviavel('2026-10', homologadaEm, agora)).not.toThrow();
    expect(() => assertCompetenciaEnviavel('2026-11', homologadaEm, agora)).not.toThrow();
    expect(() => assertCompetenciaEnviavel('2026-12', homologadaEm, agora)).toThrow(/a partir desse mês/);
    expect(() => assertCompetenciaEnviavel('2026-08', homologadaEm, agora)).toThrow(/fora da vigência/);
    expect(() => assertCompetenciaEnviavel('2026-13', homologadaEm, agora)).toThrow(/AAAA-MM/);
  });

  it('o mensal exige um texto contando o que foi feito; o final não', () => {
    expect(() => assertDescricao('MENSAL', 'pouco')).toThrow(/mínimo/);
    expect(() => assertDescricao('MENSAL', 'L'.repeat(50))).not.toThrow();
    expect(() => assertDescricao('FINAL', '')).not.toThrow();
  });
});

describe('proximaVersao (RF20/RF21)', () => {
  it('primeiro envio de cada mês é a versão 1', () => {
    expect(proximaVersao([], 'MENSAL', '2026-09')).toBe(1);
    expect(proximaVersao([relatorio('MENSAL', '2026-09', 1, 'APROVADO')], 'MENSAL', '2026-10')).toBe(1);
  });

  it('após devolução, permite nova versão do mesmo mês', () => {
    expect(proximaVersao([relatorio('MENSAL', '2026-09', 1, 'DEVOLVIDO')], 'MENSAL', '2026-09')).toBe(2);
  });

  it('bloqueia envio com versão em análise ou já aprovada', () => {
    expect(() => proximaVersao([relatorio('MENSAL', '2026-09', 1, 'ENVIADO')], 'MENSAL', '2026-09')).toThrow(/aguardando/);
    expect(() => proximaVersao([relatorio('FINAL', '', 1, 'APROVADO')], 'FINAL', '')).toThrow(/aprovado/);
  });
});

describe('situação e acompanhamento', () => {
  const homologadaEm = new Date('2026-09-10T12:00:00.000Z');

  it('deriva a situação da última versão e do prazo', () => {
    const prazo = prazoMensal('2026-09');
    const antes = new Date('2026-10-04T12:00:00.000Z');
    const depois = new Date('2026-10-07T12:00:00.000Z');
    expect(situacaoRelatorio([], 'MENSAL', '2026-09', prazo, antes)).toBe('AGUARDANDO_ENVIO');
    expect(situacaoRelatorio([], 'MENSAL', '2026-09', prazo, depois)).toBe('ATRASADO');
    expect(situacaoRelatorio([relatorio('MENSAL', '2026-09', 1, 'ENVIADO')], 'MENSAL', '2026-09', prazo, depois)).toBe(
      'EM_ANALISE',
    );
    expect(
      situacaoRelatorio(
        [relatorio('MENSAL', '2026-09', 1, 'DEVOLVIDO'), relatorio('MENSAL', '2026-09', 2, 'APROVADO')],
        'MENSAL',
        '2026-09',
        prazo,
        depois,
      ),
    ).toBe('APROVADO');
  });

  it('lista os meses já iniciados e o relatório final', () => {
    const itens = acompanhamento(homologadaEm, [relatorio('MENSAL', '2026-09', 1, 'APROVADO')], new Date('2026-11-02T12:00:00.000Z'));
    expect(itens.map((i) => `${i.tipo}:${i.competencia}:${i.situacao}`)).toEqual([
      'MENSAL:2026-09:APROVADO',
      'MENSAL:2026-10:AGUARDANDO_ENVIO',
      'MENSAL:2026-11:AGUARDANDO_ENVIO',
      'FINAL::AGUARDANDO_ENVIO',
    ]);
    expect(itens.at(-1)?.prazo).toEqual(prazoFinal(homologadaEm));
  });
});

describe('exportação (RF22 / RN09)', () => {
  it('mascara a matrícula mantendo só os 3 últimos dígitos', () => {
    expect(mascararMatricula('2023001234')).toBe('*******234');
    expect(mascararMatricula('12')).toBe('***12');
    expect(mascararMatricula(null)).toBe('');
  });

  it('gera CSV com BOM, separador ";" e escapes', () => {
    const csv = gerarCsv(['Título', 'Nota'], [['Uso de "IA"; saúde', 8.5]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('Título;Nota\r\n');
    expect(csv).toContain('"Uso de ""IA""; saúde";8.5');
  });

  it('neutraliza fórmulas (CSV injection)', () => {
    const csv = gerarCsv(['Título'], [['=HYPERLINK("x")']]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
