/**
 * Regras de negócio de projetos e relatórios — RF19–RF22.
 * Funções PURAS, sem dependência de framework/infra: cobertura unitária direta.
 */

import { UnprocessableEntityError, ValidationError } from '@shared/errors/domain.errors';

import type {
  AcompanhamentoRelatorio,
  Relatorio,
  RelatorioTipo,
  SituacaoRelatorio,
} from './projetos.types';

const DIA_MS = 24 * 60 * 60 * 1000;
const HORA_MS = 60 * 60 * 1000;

/** Fuso da UNICAP (America/Recife, UTC-3, sem horário de verão): o "dia 5" é o dia 5 no Recife. */
export const FUSO_HORAS = -3;

/** O relatório mensal de um mês vence no dia 5 do mês seguinte, às 23:59. */
export const DIA_LIMITE_MENSAL = 5;

/** Vigência da bolsa a partir da homologação. */
export const MESES_VIGENCIA = 12;
export const PRAZO_FINAL_DIAS = 365;

/** Tamanho mínimo do texto do relatório mensal. */
export const MIN_DESCRICAO = 50;

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function partes(competencia: string): { ano: number; mes: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(competencia);
  const mes = Number(match?.[2]);
  if (!match || mes < 1 || mes > 12) {
    throw new ValidationError('Mês de referência inválido. Use o formato AAAA-MM.', { competencia });
  }
  return { ano: Number(match[1]), mes };
}

function formatar(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

/** Mês (AAAA-MM) de uma data no fuso da UNICAP. */
export function competenciaDe(data: Date): string {
  const local = new Date(data.getTime() + FUSO_HORAS * HORA_MS);
  return formatar(local.getUTCFullYear(), local.getUTCMonth() + 1);
}

export function somarMeses(competencia: string, meses: number): string {
  const { ano, mes } = partes(competencia);
  const total = ano * 12 + (mes - 1) + meses;
  return formatar(Math.floor(total / 12), (total % 12) + 1);
}

/** "2026-09" → "setembro/2026". */
export function nomeCompetencia(competencia: string): string {
  const { ano, mes } = partes(competencia);
  return `${MESES[mes - 1]}/${ano}`;
}

/** Dia 5 do mês seguinte, 23:59:59.999 no fuso da UNICAP. */
export function prazoMensal(competencia: string): Date {
  const { ano, mes } = partes(somarMeses(competencia, 1));
  return new Date(Date.UTC(ano, mes - 1, DIA_LIMITE_MENSAL, 23, 59, 59, 999) - FUSO_HORAS * HORA_MS);
}

export function prazoFinal(homologadaEm: Date): Date {
  return new Date(homologadaEm.getTime() + PRAZO_FINAL_DIAS * DIA_MS);
}

/** Meses da vigência, do mês da homologação aos 11 seguintes. */
export function competenciasDaVigencia(homologadaEm: Date): string[] {
  const primeira = competenciaDe(homologadaEm);
  return Array.from({ length: MESES_VIGENCIA }, (_, i) => somarMeses(primeira, i));
}

/** Meses que já começaram: o bolsista pode relatar o mês corrente antes de ele acabar. */
export function competenciasAteAgora(homologadaEm: Date, agora: Date): string[] {
  const atual = competenciaDe(agora);
  return competenciasDaVigencia(homologadaEm).filter((c) => c <= atual);
}

export function assertCompetenciaEnviavel(competencia: string, homologadaEm: Date, agora: Date): void {
  partes(competencia);
  if (!competenciasDaVigencia(homologadaEm).includes(competencia)) {
    throw new UnprocessableEntityError(`${nomeCompetencia(competencia)} está fora da vigência da bolsa.`, {
      competencia,
    });
  }
  if (competencia > competenciaDe(agora)) {
    throw new UnprocessableEntityError(
      `O relatório de ${nomeCompetencia(competencia)} só pode ser enviado a partir desse mês.`,
      { competencia },
    );
  }
}

export function assertDescricao(tipo: RelatorioTipo, descricao: string): void {
  if (tipo === 'MENSAL' && descricao.trim().length < MIN_DESCRICAO) {
    throw new ValidationError(
      `Conte o que você fez no mês (mínimo de ${MIN_DESCRICAO} caracteres).`,
    );
  }
}

function versoesDe(relatorios: readonly Relatorio[], tipo: RelatorioTipo, competencia: string): Relatorio[] {
  return relatorios
    .filter((r) => r.tipo === tipo && r.competencia === competencia)
    .sort((a, b) => a.versao - b.versao);
}

export function situacaoRelatorio(
  relatorios: readonly Relatorio[],
  tipo: RelatorioTipo,
  competencia: string,
  prazo: Date,
  agora: Date,
): SituacaoRelatorio {
  const ultima = versoesDe(relatorios, tipo, competencia).at(-1);
  if (!ultima) {
    return agora.getTime() > prazo.getTime() ? 'ATRASADO' : 'AGUARDANDO_ENVIO';
  }
  if (ultima.status === 'APROVADO') return 'APROVADO';
  if (ultima.status === 'ENVIADO') return 'EM_ANALISE';
  return 'DEVOLVIDO';
}

/** Próxima versão de um relatório; bloqueia envio duplicado ou de relatório já aprovado. */
export function proximaVersao(relatorios: readonly Relatorio[], tipo: RelatorioTipo, competencia: string): number {
  const ultima = versoesDe(relatorios, tipo, competencia).at(-1);
  if (ultima?.status === 'ENVIADO') {
    throw new UnprocessableEntityError(
      'Já existe uma versão deste relatório aguardando análise do orientador.',
    );
  }
  if (ultima?.status === 'APROVADO') {
    throw new UnprocessableEntityError('Este relatório já foi aprovado.');
  }
  return (ultima?.versao ?? 0) + 1;
}

/** Relatórios esperados até agora (mensais já iniciados + final) e a situação de cada um. */
export function acompanhamento(
  homologadaEm: Date,
  relatorios: readonly Relatorio[],
  agora: Date,
): AcompanhamentoRelatorio[] {
  const mensais = competenciasAteAgora(homologadaEm, agora).map((competencia) => {
    const prazo = prazoMensal(competencia);
    return {
      tipo: 'MENSAL' as const,
      competencia,
      prazo,
      situacao: situacaoRelatorio(relatorios, 'MENSAL', competencia, prazo, agora),
    };
  });
  const prazo = prazoFinal(homologadaEm);
  return [
    ...mensais,
    { tipo: 'FINAL', competencia: '', prazo, situacao: situacaoRelatorio(relatorios, 'FINAL', '', prazo, agora) },
  ];
}

/** RN09 — mostra apenas os 3 últimos caracteres da matrícula. */
export function mascararMatricula(matricula: string | null): string {
  if (!matricula) return '';
  const visivel = matricula.slice(-3);
  return `${'*'.repeat(Math.max(matricula.length - 3, 3))}${visivel}`;
}

function escaparCsv(valor: string | number): string {
  const texto = String(valor);
  // Neutraliza fórmulas (CSV injection) e escapa aspas/separadores.
  // Tab e CR iniciais também disparam fórmula em algumas planilhas (OWASP).
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
  return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

const BOM_UTF8 = String.fromCharCode(0xfeff);

/** CSV separado por ";" com BOM UTF-8 — abre corretamente no Excel em pt-BR. */
export function gerarCsv(cabecalho: readonly string[], linhas: ReadonlyArray<ReadonlyArray<string | number>>): string {
  const corpo = [cabecalho, ...linhas].map((linha) => linha.map(escaparCsv).join(';')).join('\r\n');
  return `${BOM_UTF8}${corpo}\r\n`;
}
