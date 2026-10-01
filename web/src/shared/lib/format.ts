/** Formatadores pt-BR. Datas chegam da API como ISO 8601 (UTC). */

const dataFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dataHoraFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const horaFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const notaFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });

export function formatDate(iso: string | null | undefined): string {
  return iso ? dataFmt.format(new Date(iso)) : '-';
}

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dataHoraFmt.format(new Date(iso)) : '-';
}

export function formatTime(date: Date): string {
  return horaFmt.format(date);
}

export function formatNota(nota: number | null | undefined): string {
  return nota === null || nota === undefined ? '-' : notaFmt.format(nota);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

/** "há 3 dias", "em 12 dias", "hoje" — relativo a `agora`. */
export function formatRelativeDays(iso: string, agora: Date = new Date()): string {
  const dias = Math.round((new Date(iso).getTime() - agora.getTime()) / 86_400_000);
  if (dias === 0) return 'hoje';
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  return rtf.format(dias, 'day');
}

/** Dias inteiros até a data (negativo se já passou). */
export function diasAte(iso: string, agora: Date = new Date()): number {
  return Math.ceil((new Date(iso).getTime() - agora.getTime()) / 86_400_000);
}

/** Converte "AAAA-MM-DD" (input date) em ISO no início ou no fim do dia, horário local. */
export function dateInputToIso(value: string, fimDoDia: boolean): string {
  const [ano, mes, dia] = value.split('-').map(Number);
  const date = fimDoDia
    ? new Date(ano ?? 0, (mes ?? 1) - 1, dia ?? 1, 23, 59, 59, 999)
    : new Date(ano ?? 0, (mes ?? 1) - 1, dia ?? 1, 0, 0, 0, 0);
  return date.toISOString();
}

/** ISO → "AAAA-MM-DD" no fuso local (valor de input type="date"). */
export function isoToDateInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function iniciais(nome: string): string {
  const partes = nome
    .replace(/^(prof\.?|profa\.?|dr\.?|dra\.?)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean);
  const primeira = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? (partes.at(-1)?.[0] ?? '') : '';
  return `${primeira}${ultima}`.toUpperCase();
}

export function pluralize(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
