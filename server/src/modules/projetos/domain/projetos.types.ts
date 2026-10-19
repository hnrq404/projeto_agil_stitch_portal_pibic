import type { ArquivoRef } from '@shared/storage/arquivo.storage';

/**
 * MENSAL: todo dia 5 o bolsista conta o que fez no mês anterior.
 * FINAL: ao fim dos 12 meses de vigência, com o PDF do relatório final.
 */
export type RelatorioTipo = 'MENSAL' | 'FINAL';
export type RelatorioStatus = 'ENVIADO' | 'APROVADO' | 'DEVOLVIDO';

export const RELATORIO_TIPOS: readonly RelatorioTipo[] = ['MENSAL', 'FINAL'];

/** Uma versão de relatório. Devolvido → o bolsista envia nova versão (histórico mantido, RF21). */
export interface Relatorio {
  id: string;
  /** O projeto é a inscrição aprovada. */
  inscricaoId: string;
  tipo: RelatorioTipo;
  /** Mês de referência ("2026-09") do relatório mensal; vazio no final. */
  competencia: string;
  versao: number;
  status: RelatorioStatus;
  /** O que o bolsista fez no período. */
  descricao: string;
  /** PDF opcional no mensal e obrigatório para aprovar o final. */
  arquivo: ArquivoRef | null;
  comentarioOrientador: string | null;
  enviadoEm: Date;
  avaliadoEm: Date | null;
}

/** Situação de cada relatório esperado, derivada das versões e do prazo (exibida na UI). */
export type SituacaoRelatorio = 'AGUARDANDO_ENVIO' | 'ATRASADO' | 'EM_ANALISE' | 'DEVOLVIDO' | 'APROVADO';

/** Um relatório esperado do bolsista: cada mês da vigência e o final. */
export interface AcompanhamentoRelatorio {
  tipo: RelatorioTipo;
  competencia: string;
  prazo: Date;
  situacao: SituacaoRelatorio;
}
