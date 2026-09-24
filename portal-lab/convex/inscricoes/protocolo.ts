/**
 * Protocolo único da inscrição (S3 / [[Arquitetura]] §4): formato CNPq
 * `23076.014821/2026-11` — exibido em JetBrains Mono na UI (DESIGN.md).
 *
 * Geração exclusivamente no backend; a mutation `submeter` verifica
 * unicidade pelo índice `protocolo` antes de persistir.
 */
export function gerarProtocolo(now: number, rand: () => number = Math.random): string {
  const data = new Date(now);
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const raiz = String(Math.floor(rand() * 100_000)).padStart(5, "0");
  const sequencia = String(Math.floor(rand() * 1_000_000)).padStart(6, "0");
  return `${raiz}.${sequencia}/${ano}-${mes}`;
}

export const PROTOCOLO_REGEX = /^\d{5}\.\d{6}\/\d{4}-\d{2}$/;
