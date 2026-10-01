/**
 * Regra de consistência de cotas (espelha validateCotas do backend) para
 * feedback em tempo real no formulário. O backend continua sendo a autoridade.
 */
export interface ResumoCotas {
  soma: number;
  restante: number;
  excede: boolean;
  completa: boolean;
  duplicadas: string[];
}

export function resumoCotas(
  totalCotas: number,
  cotas: ReadonlyArray<{ subareaCode: string; quantidade: number | string }>,
): ResumoCotas {
  const total = Number.isFinite(totalCotas) ? totalCotas : 0;
  const soma = cotas.reduce((acc, c) => acc + (Number(c.quantidade) || 0), 0);
  const vistos = new Set<string>();
  const duplicadas = new Set<string>();
  for (const { subareaCode } of cotas) {
    if (!subareaCode) continue;
    if (vistos.has(subareaCode)) duplicadas.add(subareaCode);
    vistos.add(subareaCode);
  }
  return {
    soma,
    restante: total - soma,
    excede: soma > total,
    completa: soma === total && total > 0,
    duplicadas: [...duplicadas],
  };
}

/** Texto do indicador de soma (usado também pelo teste E2E). */
export function mensagemCotas(total: number, resumo: ResumoCotas): string {
  if (resumo.excede) {
    return `A soma das cotas (${resumo.soma}) EXCEDE o total de bolsas (${total}). Ajuste antes de salvar.`;
  }
  return `Soma distribuída: ${resumo.soma} de ${total} bolsas ${
    resumo.completa ? '(distribuição completa)' : `(restam ${resumo.restante})`
  }`;
}
