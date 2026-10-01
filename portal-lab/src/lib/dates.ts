const DAY = 24 * 60 * 60 * 1000;

/** epoch ms para o valor de um <input type="date"> (yyyy-mm-dd, fuso local). */
export function toInputDate(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms)) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Valor do <input type="date"> para epoch ms. A abertura vale desde 00:00 e
 * o encerramento até 23:59 do dia escolhido — como o usuário espera.
 */
export function fromInputDate(value: string, endOfDay: boolean): number {
  if (!value) return Number.NaN;
  return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`).getTime();
}

/** "encerra hoje", "faltam 3 dias", "encerrado há 2 dias". */
export function prazoRelativo(fim: number, now = Date.now()): string {
  const dias = Math.ceil((fim - now) / DAY);
  if (fim < now) {
    const passados = Math.max(1, Math.floor((now - fim) / DAY));
    return passados === 1 ? "encerrou ontem" : `encerrou há ${passados} dias`;
  }
  if (dias <= 1) return "encerra hoje";
  return `faltam ${dias} dias`;
}
