import type { ArquivoRef } from '@shared/storage/arquivo.storage';

export type RelatorioTipo = 'PARCIAL' | 'FINAL';
export type RelatorioStatus = 'ENVIADO' | 'APROVADO' | 'DEVOLVIDO';

export const RELATORIO_TIPOS: readonly RelatorioTipo[] = ['PARCIAL', 'FINAL'];

/** Uma versão de relatório. Devolvido → o bolsista envia nova versão (histórico mantido, RF21). */
export interface Relatorio extends ArquivoRef {
  id: string;
  /** O projeto é a inscrição aprovada. */
  inscricaoId: string;
  tipo: RelatorioTipo;
  versao: number;
  status: RelatorioStatus;
  comentarioOrientador: string | null;
  enviadoEm: Date;
  avaliadoEm: Date | null;
}

/** Situação de cada tipo de relatório, derivada das versões e do prazo (exibida na UI). */
export type SituacaoRelatorio = 'AGUARDANDO_ENVIO' | 'ATRASADO' | 'EM_ANALISE' | 'DEVOLVIDO' | 'APROVADO';
