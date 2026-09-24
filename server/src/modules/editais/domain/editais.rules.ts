/**
 * Regras de negócio do agregado Edital — Sprint 2.
 * Funções PURAS, sem dependência de framework/infra: cobertura unitária direta.
 */

import { isKnownCnpqAreaCode, findCnpqAreaByCode } from '@shared/domain/cnpq-areas';
import { ValidationError, UnprocessableEntityError } from '@shared/errors/domain.errors';
import type { Clock } from '@shared/time/clock';

import type { Edital, EditalStatus } from './editais.types';

export const EDITAL_STATUS: readonly EditalStatus[] = ['RASCUNHO', 'PUBLICADO', 'ENCERRADO'] as const;

/** Transições válidas do ciclo de vida — RN01/S2.3. */
export const EDITAL_TRANSITIONS: Record<EditalStatus, readonly EditalStatus[]> = {
  RASCUNHO: ['PUBLICADO'],
  PUBLICADO: ['ENCERRADO'],
  ENCERRADO: [],
};

/**
 * RN01 — "Edital em estado ENCERRADO não pode ser reaberto".
 * Também bloqueia saltos (RASCUNHO → ENCERRADO) e retrocessos (PUBLICADO → RASCUNHO).
 */
export function assertTransition(
  current: EditalStatus,
  target: EditalStatus,
): void {
  const allowed = EDITAL_TRANSITIONS[current] ?? [];
  if (!allowed.includes(target)) {
    throw new UnprocessableEntityError(
      `Transição de status inválida: ${current} → ${target}. ` +
        `Fluxo permitido: RASCUNHO → PUBLICADO → ENCERRADO; edital ENCERRADO é terminal (RN01).`,
      { current, target, allowed },
    );
  }
}

/** Somente edital em RASCUNHO pode ser editado (regra da Sprint 2). */
export function assertEditable(edital: Edital): void {
  if (edital.status !== 'RASCUNHO') {
    throw new UnprocessableEntityError(
      `Somente editais em RASCUNHO podem ser editados (status atual: ${edital.status}).`,
      { status: edital.status, editalId: edital.id },
    );
  }
}

/**
 * Regra de Consistência de Cotas:
 * a soma das cotas por subárea CNPq NÃO pode ultrapassar o total de cotas do edital.
 * Subáreas repetidas são mescladas antes da validação (ex.: dois lançamentos de "1.03").
 */
export function validateCotas(
  totalCotas: number,
  cotas: ReadonlyArray<{ subareaCode: string; quantidade: number }>,
): { subareaCode: string; subareaNome: string; quantidade: number }[] {
  if (!Number.isInteger(totalCotas) || totalCotas < 1) {
    throw new ValidationError('totalCotas deve ser um inteiro ≥ 1.');
  }

  const merged = new Map<string, number>();
  for (const cota of cotas) {
    if (!isKnownCnpqAreaCode(cota.subareaCode)) {
      throw new ValidationError(
        `Subárea CNPq desconhecida: "${cota.subareaCode}". Use um código da Tabela de Áreas do Conhecimento (ex.: "1.03").`,
        { subareaCode: cota.subareaCode },
      );
    }
    if (!Number.isInteger(cota.quantidade) || cota.quantidade < 1) {
      throw new ValidationError(
        `quantidade da subárea "${cota.subareaCode}" deve ser um inteiro ≥ 1.`,
      );
    }
    merged.set(cota.subareaCode, (merged.get(cota.subareaCode) ?? 0) + cota.quantidade);
  }

  const soma = [...merged.values()].reduce((acc, n) => acc + n, 0);
  if (soma > totalCotas) {
    throw new UnprocessableEntityError(
      `Soma das cotas por subárea (${soma}) ultrapassa o total de cotas do edital (${totalCotas}).`,
      { soma, totalCotas },
    );
  }

  return [...merged.entries()].map(([subareaCode, quantidade]) => ({
    subareaCode,
    subareaNome: findCnpqAreaByCode(subareaCode)?.name ?? subareaCode,
    quantidade,
  }));
}

/** RASCUNHO → PUBLICADO: exige dados mínimos e janela de inscrições coerente. */
export function assertPublishable(
  edital: Edital,
  clock: Clock,
): void {
  const now = clock.now();

  if (!edital.numero?.trim()) {
    throw new UnprocessableEntityError('Edital sem "numero" não pode ser publicado.');
  }
  if (!edital.titulo?.trim()) {
    throw new UnprocessableEntityError('Edital sem "titulo" não pode ser publicado.');
  }
  if (!edital.cotas.length) {
    throw new UnprocessableEntityError(
      'Edital sem cotas por subárea CNPq não pode ser publicado (defina ao menos uma cota).',
    );
  }
  validateCotas(edital.totalCotas, edital.cotas);

  if (edital.dataFimInscricoes <= edital.dataInicioInscricoes) {
    throw new UnprocessableEntityError(
      'dataFimInscricoes deve ser posterior a dataInicioInscricoes.',
    );
  }
  if (edital.dataFimInscricoes.getTime() <= now.getTime()) {
    throw new UnprocessableEntityError(
      'Não é possível publicar edital com prazo de inscrições já expirado.',
      { dataFimInscricoes: edital.dataFimInscricoes.toISOString(), now: now.toISOString() },
    );
  }
}

/** PUBLICADO → ENCERRADO (manual) ou encerramento automático por prazo. */
export function assertClosable(edital: Edital, clock: Clock): void {
  if (edital.status !== 'PUBLICADO') {
    throw new UnprocessableEntityError(
      `Apenas editais PUBLICADO podem ser encerrados (status atual: ${edital.status}).`,
    );
  }
  if (edital.dataFimInscricoes.getTime() > clock.now().getTime()) {
    throw new UnprocessableEntityError(
      'Edital ainda dentro do prazo de inscrições; encerramento manual antecipado exige justificativa — bloqueado nesta versão.',
    );
  }
}

/** Edital está no prazo de inscrições agora? (listagem pública). */
export function isInscricaoAberta(edital: Edital, clock: Clock): boolean {
  const now = clock.now().getTime();
  return (
    edital.status === 'PUBLICADO' &&
    edital.dataInicioInscricoes.getTime() <= now &&
    now <= edital.dataFimInscricoes.getTime()
  );
}

/** Recalcula o status de editais publicados cujo prazo expirou (S2.3 — transição automática). */
export function resolveAutomaticStatus(edital: Edital, clock: Clock): EditalStatus {
  if (edital.status === 'PUBLICADO' && edital.dataFimInscricoes.getTime() < clock.now().getTime()) {
    return 'ENCERRADO';
  }
  return edital.status;
}
