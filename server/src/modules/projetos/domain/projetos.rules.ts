/**
 * Regras de negócio de projetos e relatórios — RF19–RF22.
 * Funções PURAS, sem dependência de framework/infra: cobertura unitária direta.
 */

import { UnprocessableEntityError } from '@shared/errors/domain.errors';

import type { Relatorio, RelatorioTipo, SituacaoRelatorio } from './projetos.types';

const DIA_MS = 24 * 60 * 60 * 1000;

/** Prazo de cada relatório contado a partir da homologação (vigência de 12 meses). */
export const PRAZO_DIAS: Record<RelatorioTipo, number> = {
  PARCIAL: 180,
  FINAL: 365,
};

export function prazoRelatorio(homologadaEm: Date, tipo: RelatorioTipo): Date {
  return new Date(homologadaEm.getTime() + PRAZO_DIAS[tipo] * DIA_MS);
}

function versoesDoTipo(relatorios: readonly Relatorio[], tipo: RelatorioTipo): Relatorio[] {
  return relatorios.filter((r) => r.tipo === tipo).sort((a, b) => a.versao - b.versao);
}

export function situacaoRelatorio(
  relatorios: readonly Relatorio[],
  tipo: RelatorioTipo,
  prazo: Date,
  agora: Date,
): SituacaoRelatorio {
  const ultima = versoesDoTipo(relatorios, tipo).at(-1);
  if (!ultima) {
    return agora.getTime() > prazo.getTime() ? 'ATRASADO' : 'AGUARDANDO_ENVIO';
  }
  if (ultima.status === 'APROVADO') return 'APROVADO';
  if (ultima.status === 'ENVIADO') return 'EM_ANALISE';
  return 'DEVOLVIDO';
}

/** Próxima versão de um relatório; bloqueia envio duplicado, já aprovado ou final antes do parcial. */
export function proximaVersao(relatorios: readonly Relatorio[], tipo: RelatorioTipo): number {
  const versoes = versoesDoTipo(relatorios, tipo);
  const ultima = versoes.at(-1);
  if (ultima?.status === 'ENVIADO') {
    throw new UnprocessableEntityError(
      'Já existe uma versão deste relatório aguardando análise do orientador.',
    );
  }
  if (ultima?.status === 'APROVADO') {
    throw new UnprocessableEntityError('Este relatório já foi aprovado.');
  }
  if (tipo === 'FINAL') {
    const parcialAprovado = versoesDoTipo(relatorios, 'PARCIAL').some((r) => r.status === 'APROVADO');
    if (!parcialAprovado) {
      throw new UnprocessableEntityError(
        'O relatório final só pode ser enviado depois que o parcial for aprovado.',
      );
    }
  }
  return (ultima?.versao ?? 0) + 1;
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
  const seguro = /^[=+\-@]/.test(texto) ? `'${texto}` : texto;
  return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** CSV separado por ";" com BOM UTF-8 — abre corretamente no Excel em pt-BR. */
export function gerarCsv(cabecalho: readonly string[], linhas: ReadonlyArray<ReadonlyArray<string | number>>): string {
  const corpo = [cabecalho, ...linhas].map((linha) => linha.map(escaparCsv).join(';')).join('\r\n');
  return `\uFEFF${corpo}\r\n`;
}
