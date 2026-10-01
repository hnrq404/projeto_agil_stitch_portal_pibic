import {
  gerarCsv,
  mascararMatricula,
  prazoRelatorio,
  proximaVersao,
  situacaoRelatorio,
} from '@projetos/domain/projetos.rules';
import type { Relatorio, RelatorioStatus, RelatorioTipo } from '@projetos/domain/projetos.types';

function relatorio(tipo: RelatorioTipo, versao: number, status: RelatorioStatus): Relatorio {
  return {
    id: `${tipo}-${versao}`,
    inscricaoId: 'p1',
    tipo,
    versao,
    status,
    comentarioOrientador: null,
    storageKey: 'k',
    nome: 'r.pdf',
    tamanho: 1,
    mimeType: 'application/pdf',
    enviadoEm: new Date('2026-12-01T00:00:00.000Z'),
    avaliadoEm: null,
  };
}

describe('proximaVersao (RF20/RF21)', () => {
  it('primeiro envio é a versão 1', () => {
    expect(proximaVersao([], 'PARCIAL')).toBe(1);
  });

  it('após devolução, permite nova versão', () => {
    expect(proximaVersao([relatorio('PARCIAL', 1, 'DEVOLVIDO')], 'PARCIAL')).toBe(2);
  });

  it('bloqueia envio com versão em análise ou já aprovada', () => {
    expect(() => proximaVersao([relatorio('PARCIAL', 1, 'ENVIADO')], 'PARCIAL')).toThrow(/aguardando/);
    expect(() => proximaVersao([relatorio('PARCIAL', 1, 'APROVADO')], 'PARCIAL')).toThrow(/aprovado/);
  });

  it('relatório final exige parcial aprovado', () => {
    expect(() => proximaVersao([], 'FINAL')).toThrow(/parcial/);
    expect(proximaVersao([relatorio('PARCIAL', 2, 'APROVADO')], 'FINAL')).toBe(1);
  });
});

describe('situacaoRelatorio', () => {
  const homologadaEm = new Date('2026-12-01T00:00:00.000Z');
  const prazo = prazoRelatorio(homologadaEm, 'PARCIAL');

  it('prazo parcial é 180 dias após a homologação', () => {
    expect(prazo.toISOString()).toBe('2027-05-30T00:00:00.000Z');
  });

  it('deriva a situação da última versão e do prazo', () => {
    expect(situacaoRelatorio([], 'PARCIAL', prazo, homologadaEm)).toBe('AGUARDANDO_ENVIO');
    expect(situacaoRelatorio([], 'PARCIAL', prazo, new Date('2027-06-01'))).toBe('ATRASADO');
    expect(situacaoRelatorio([relatorio('PARCIAL', 1, 'ENVIADO')], 'PARCIAL', prazo, homologadaEm)).toBe('EM_ANALISE');
    expect(
      situacaoRelatorio(
        [relatorio('PARCIAL', 1, 'DEVOLVIDO'), relatorio('PARCIAL', 2, 'APROVADO')],
        'PARCIAL',
        prazo,
        homologadaEm,
      ),
    ).toBe('APROVADO');
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
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Título;Nota\r\n');
    expect(csv).toContain('"Uso de ""IA""; saúde";8.5');
  });

  it('neutraliza fórmulas (CSV injection)', () => {
    const csv = gerarCsv(['Título'], [['=HYPERLINK("x")']]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
