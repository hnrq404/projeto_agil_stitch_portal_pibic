import { v } from "convex/values";
import { AREAS_CNPQ } from "../areas";

/**
 * Regras de negócio do edital (M2 / S2.1–S2.4). Funções puras, sem acesso
 * ao banco, usadas pelas mutations, pelo frontend e pelos testes unitários.
 */

export const EDITAL_STATUS = {
  RASCUNHO: "rascunho",
  PUBLICADO: "publicado",
  EM_AVALIACAO: "em_avaliacao",
  ENCERRADO: "encerrado",
} as const;

export type EditalStatus = (typeof EDITAL_STATUS)[keyof typeof EDITAL_STATUS];

export const EDITAL_STATUSES: readonly EditalStatus[] = [
  EDITAL_STATUS.RASCUNHO,
  EDITAL_STATUS.PUBLICADO,
  EDITAL_STATUS.EM_AVALIACAO,
  EDITAL_STATUS.ENCERRADO,
];

export const statusValidator = v.union(...EDITAL_STATUSES.map((s) => v.literal(s)));

/** Rótulos exibidos ao usuário (Backlog: Ativa / Em Análise / Finalizada). */
export const STATUS_LABELS: Record<EditalStatus, string> = {
  rascunho: "Rascunho",
  publicado: "Inscrições abertas",
  em_avaliacao: "Em análise",
  encerrado: "Finalizado",
};

export const PROGRAMAS = ["PIBIC", "PIBITI", "INTERNO"] as const;
export type Programa = (typeof PROGRAMAS)[number];
export const programaValidator = v.union(...PROGRAMAS.map((p) => v.literal(p)));

export type Cota = { area: string; total: number; ocupadas: number };

export const cotaValidator = v.object({
  area: v.string(),
  total: v.number(),
  ocupadas: v.number(),
});

/** Transições manuais permitidas (S2.3). RN01: "encerrado" não tem saída. */
const TRANSITIONS: Record<EditalStatus, EditalStatus[]> = {
  rascunho: ["publicado"],
  publicado: ["em_avaliacao"],
  em_avaliacao: ["encerrado"],
  encerrado: [],
};

export function canTransition(from: EditalStatus, to: EditalStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** RN04: somente estes estados aparecem na lista pública. */
export function isPublic(status: EditalStatus): boolean {
  return status === "publicado" || status === "em_avaliacao";
}

/** Transição automática por data: prazo vencido fecha as inscrições. */
export function shouldAutoClose(status: EditalStatus, dataEncerramento: number, now: number) {
  return status === "publicado" && now > dataEncerramento;
}

/**
 * RN02: rascunho é editável por completo; com inscrições abertas só é
 * permitido estender o prazo; depois disso nada pode ser editado.
 */
export type EditMode = "completo" | "somente-prazo" | "bloqueado";

export function editMode(status: EditalStatus): EditMode {
  if (status === "rascunho") return "completo";
  if (status === "publicado") return "somente-prazo";
  return "bloqueado";
}

export type EditalInput = {
  titulo: string;
  programa: string;
  dataAbertura: number;
  dataEncerramento: number;
  cotasPorArea: Cota[];
};

export type EditalErrors = Partial<Record<"titulo" | "programa" | "datas" | "cotas", string>>;

/** Validação de S2.1 — mensagens em linguagem simples, prontas para a UI. */
export function validateEdital(input: EditalInput): EditalErrors {
  const errors: EditalErrors = {};
  if (input.titulo.trim().length < 5) {
    errors.titulo = "Informe um título com pelo menos 5 caracteres.";
  }
  if (!(PROGRAMAS as readonly string[]).includes(input.programa)) {
    errors.programa = "Escolha o programa do edital.";
  }
  if (!Number.isFinite(input.dataAbertura) || !Number.isFinite(input.dataEncerramento)) {
    errors.datas = "Informe as datas de abertura e de encerramento.";
  } else if (input.dataEncerramento <= input.dataAbertura) {
    errors.datas = "O encerramento precisa ser depois da abertura.";
  }
  errors.cotas = validateCotas(input.cotasPorArea);
  if (!errors.cotas) delete errors.cotas;
  return errors;
}

export function validateCotas(cotas: Cota[]): string | undefined {
  if (cotas.length === 0) return "Adicione ao menos uma área com bolsas.";
  const seen = new Set<string>();
  for (const c of cotas) {
    if (!(AREAS_CNPQ as readonly string[]).includes(c.area)) {
      return `A área "${c.area}" não é uma grande área CNPq válida.`;
    }
    if (seen.has(c.area)) return `A área "${c.area}" aparece mais de uma vez.`;
    seen.add(c.area);
    if (!Number.isInteger(c.total) || c.total < 1) {
      return `Informe um número inteiro de bolsas (mínimo 1) para ${c.area}.`;
    }
    if (c.ocupadas > c.total) {
      return `${c.area} já tem ${c.ocupadas} bolsas ocupadas; o total não pode ser menor.`;
    }
  }
  return undefined;
}

export function totalCotas(cotas: Cota[]): { total: number; ocupadas: number } {
  return cotas.reduce(
    (acc, c) => ({ total: acc.total + c.total, ocupadas: acc.ocupadas + c.ocupadas }),
    { total: 0, ocupadas: 0 },
  );
}

/** Número sequencial por ano, ex.: "003/2026". */
export function formatNumero(sequencial: number, ano: number): string {
  return `${String(sequencial).padStart(3, "0")}/${ano}`;
}

/** Datas sempre no fuso da instituição, inclusive no servidor (que roda em UTC). */
export function formatData(ms: number): string {
  return new Date(ms).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
