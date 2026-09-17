/** Formatadores compartilhados (Módulo `shared` do [[Arquitetura]]). */

const dataFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const dataHoraFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function formatarData(epochMs: number | undefined | null): string {
  if (!epochMs) return "—";
  return dataFmt.format(new Date(epochMs));
}

export function formatarDataHora(epochMs: number | undefined | null): string {
  if (!epochMs) return "—";
  return dataHoraFmt.format(new Date(epochMs));
}

/** 2.4 MB / 620 KB — tabular numerals na UI (DESIGN.md). */
export function formatarTamanho(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}
