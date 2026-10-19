/**
 * Regras de negócio do projeto de pesquisa (agregado Inscrição) e da
 * candidatura do aluno. Funções PURAS, sem dependência de framework/infra:
 * cobertura unitária direta.
 */

import { UnprocessableEntityError } from '@shared/errors/domain.errors';
import type { Clock } from '@shared/time/clock';

import type { Edital } from '../../editais/domain/editais.types';
import { isInscricaoAberta } from '../../editais/domain/editais.rules';
import { ANEXO_LABEL, ANEXO_TIPOS, type Inscricao, type InscricaoStatus } from './inscricoes.types';

/** Limites mínimos de conteúdo para um projeto ser divulgado. */
export const MIN_RESUMO = 100;
export const MIN_TEXTO = 50;

/** Tamanho mínimo da apresentação do aluno na candidatura. */
export const MIN_MENSAGEM_CANDIDATURA = 30;

/** Prefixo institucional do protocolo (padrão de processos da universidade). */
export const PROTOCOLO_PREFIXO = '23076';

export const INSCRICAO_TRANSITIONS: Record<InscricaoStatus, readonly InscricaoStatus[]> = {
  RASCUNHO: ['DIVULGADA'],
  DIVULGADA: ['EM_AVALIACAO'],
  EM_AVALIACAO: ['AVALIADA'],
  AVALIADA: ['APROVADA', 'RECUSADA'],
  APROVADA: [],
  RECUSADA: [],
};

export function assertInscricaoTransition(current: InscricaoStatus, target: InscricaoStatus): void {
  if (!INSCRICAO_TRANSITIONS[current].includes(target)) {
    throw new UnprocessableEntityError(
      `Transição de projeto inválida: ${current} → ${target}.`,
      { current, target, allowed: INSCRICAO_TRANSITIONS[current] },
    );
  }
}

/** Projetos só são criados, divulgados e enviados com o edital publicado e dentro do prazo. */
export function assertEditalAceitaInscricoes(edital: Edital, clock: Clock): void {
  if (!isInscricaoAberta(edital, clock)) {
    throw new UnprocessableEntityError(
      `O edital ${edital.numero} não está com inscrições abertas.`,
      { editalId: edital.id, status: edital.status },
    );
  }
}

/** RN05 — depois do envio ao edital, o projeto não pode mais ser editado. */
export function assertEditavel(inscricao: Inscricao): void {
  if (inscricao.status !== 'RASCUNHO' && inscricao.status !== 'DIVULGADA') {
    throw new UnprocessableEntityError(
      'Este projeto já foi enviado ao edital e não pode mais ser editado (RN05).',
      { status: inscricao.status },
    );
  }
}

/** Candidaturas e seleção só acontecem enquanto o projeto está divulgado. */
export function assertDivulgada(inscricao: Inscricao): void {
  if (inscricao.status !== 'DIVULGADA') {
    throw new UnprocessableEntityError(
      inscricao.status === 'RASCUNHO'
        ? 'O projeto ainda não foi divulgado aos alunos.'
        : 'O projeto já foi enviado ao edital e não recebe mais candidaturas.',
      { status: inscricao.status },
    );
  }
}

/** O que falta para o professor divulgar o projeto aos alunos. */
export function pendenciasParaDivulgacao(inscricao: Inscricao, edital: Edital): string[] {
  const pendencias: string[] = [];
  if (inscricao.titulo.trim().length < 10) {
    pendencias.push('Informe o título do projeto (mínimo de 10 caracteres).');
  }
  if (!inscricao.subareaCode) {
    pendencias.push('Selecione a subárea CNPq.');
  } else if (!edital.cotas.some((c) => c.subareaCode === inscricao.subareaCode)) {
    pendencias.push('A subárea escolhida não tem cotas neste edital.');
  }
  if (inscricao.resumo.trim().length < MIN_RESUMO) {
    pendencias.push(`Escreva o resumo (mínimo de ${MIN_RESUMO} caracteres).`);
  }
  if (inscricao.objetivos.trim().length < MIN_TEXTO) {
    pendencias.push(`Descreva os objetivos (mínimo de ${MIN_TEXTO} caracteres).`);
  }
  if (inscricao.metodologia.trim().length < MIN_TEXTO) {
    pendencias.push(`Descreva a metodologia (mínimo de ${MIN_TEXTO} caracteres).`);
  }
  return pendencias;
}

/**
 * O que falta para enviar ao edital. Vazia = pronto. A mesma lista é devolvida
 * à SPA para montar o checklist. Os avaliadores são validados à parte, no envio.
 */
export function pendenciasParaSubmissao(inscricao: Inscricao, edital: Edital): string[] {
  const pendencias = pendenciasParaDivulgacao(inscricao, edital);
  if (inscricao.status === 'RASCUNHO') {
    pendencias.push('Divulgue o projeto para receber candidaturas dos alunos.');
  }
  if (!inscricao.discenteId) {
    pendencias.push('Selecione o aluno entre os candidatos.');
  }
  for (const tipo of ANEXO_TIPOS) {
    if (!inscricao.anexos.some((a) => a.tipo === tipo)) {
      pendencias.push(`Anexe o ${ANEXO_LABEL[tipo].toLowerCase()} em PDF.`);
    }
  }
  return pendencias;
}

/** Dígito verificador (2 dígitos, módulo 97) — detecta erros de digitação do protocolo. */
export function digitoVerificador(base: string): string {
  const numerico = base.replace(/\D/g, '');
  let resto = 0;
  for (const ch of numerico) {
    resto = (resto * 10 + Number(ch)) % 97;
  }
  return String(98 - ((resto * 100) % 97)).padStart(2, '0');
}

/** Ex.: gerarProtocolo(14821, 2026) → "23076.014821/2026-NN". */
export function gerarProtocolo(sequencial: number, ano: number): string {
  if (!Number.isInteger(sequencial) || sequencial < 1 || sequencial > 999_999) {
    throw new RangeError('Sequencial de protocolo fora do intervalo 1..999999.');
  }
  const base = `${PROTOCOLO_PREFIXO}.${String(sequencial).padStart(6, '0')}/${ano}`;
  return `${base}-${digitoVerificador(base)}`;
}

export function protocoloValido(protocolo: string): boolean {
  const match = /^(\d{5}\.\d{6}\/\d{4})-(\d{2})$/.exec(protocolo);
  return Boolean(match && digitoVerificador(match[1] as string) === match[2]);
}

/**
 * Homologação (S5): a aprovação não pode ultrapassar a cota da subárea.
 * `aprovadasNaSubarea` não inclui a inscrição que está sendo homologada.
 */
export function assertCotaDisponivel(
  edital: Edital,
  subareaCode: string,
  aprovadasNaSubarea: number,
): void {
  const cota = edital.cotas.find((c) => c.subareaCode === subareaCode);
  const total = cota?.quantidade ?? 0;
  if (aprovadasNaSubarea >= total) {
    throw new UnprocessableEntityError(
      `Cota esgotada: ${aprovadasNaSubarea} de ${total} bolsa(s) da subárea ${subareaCode} já foram aprovadas.`,
      { subareaCode, aprovadas: aprovadasNaSubarea, total },
    );
  }
}
