import { describe, expect, it } from "vitest";
import {
  AREA_LEGADO,
  canTransition,
  cotasDoEdital,
  editMode,
  formatData,
  formatNumero,
  isPublic,
  shouldAutoClose,
  totalCotas,
  validateCotas,
  validateEdital,
} from "../../convex/editais/rules";
import type { EditalInput } from "../../convex/editais/rules";

const valido: EditalInput = {
  titulo: "Iniciação Científica 2026/2027",
  programa: "PIBIC",
  dataAbertura: Date.UTC(2026, 9, 1, 3),
  dataEncerramento: Date.UTC(2026, 10, 1, 2, 59),
  cotasPorArea: [
    { area: "Engenharias", total: 10, ocupadas: 0 },
    { area: "Ciências Biológicas", total: 5, ocupadas: 0 },
  ],
};

describe("validateEdital (S2.1)", () => {
  it("aceita um edital completo", () => {
    expect(validateEdital(valido)).toEqual({});
  });

  it("exige título com pelo menos 5 caracteres", () => {
    expect(validateEdital({ ...valido, titulo: "  abc " }).titulo).toBeDefined();
  });

  it("rejeita programa desconhecido", () => {
    expect(validateEdital({ ...valido, programa: "PIVIC" }).programa).toBeDefined();
  });

  it("exige encerramento depois da abertura", () => {
    const errors = validateEdital({ ...valido, dataEncerramento: valido.dataAbertura });
    expect(errors.datas).toMatch(/depois da abertura/);
  });

  it("exige as duas datas", () => {
    expect(validateEdital({ ...valido, dataAbertura: Number.NaN }).datas).toMatch(/Informe/);
  });
});

describe("validateCotas", () => {
  it("exige ao menos uma área", () => {
    expect(validateCotas([])).toMatch(/ao menos uma área/);
  });

  it("rejeita área repetida", () => {
    const c = { area: "Engenharias", total: 1, ocupadas: 0 };
    expect(validateCotas([c, c])).toMatch(/mais de uma vez/);
  });

  it("rejeita área fora da lista CNPq", () => {
    expect(validateCotas([{ area: "Astrologia", total: 1, ocupadas: 0 }])).toMatch(
      /não é uma grande área/,
    );
  });

  it("exige número inteiro de bolsas maior que zero", () => {
    expect(validateCotas([{ area: "Engenharias", total: 0, ocupadas: 0 }])).toBeDefined();
    expect(validateCotas([{ area: "Engenharias", total: 2.5, ocupadas: 0 }])).toBeDefined();
    expect(validateCotas([{ area: "Engenharias", total: Number.NaN, ocupadas: 0 }])).toBeDefined();
  });

  it("não deixa o total ficar abaixo das bolsas já ocupadas", () => {
    expect(validateCotas([{ area: "Engenharias", total: 3, ocupadas: 4 }])).toMatch(/ocupadas/);
  });
});

describe("ciclo de vida (S2.3)", () => {
  it("segue rascunho, publicado, em análise, encerrado", () => {
    expect(canTransition("rascunho", "publicado")).toBe(true);
    expect(canTransition("publicado", "em_avaliacao")).toBe(true);
    expect(canTransition("em_avaliacao", "encerrado")).toBe(true);
  });

  it("bloqueia saltos e retrocessos", () => {
    expect(canTransition("rascunho", "encerrado")).toBe(false);
    expect(canTransition("em_avaliacao", "publicado")).toBe(false);
  });

  it("RN01: edital encerrado não pode ser reaberto", () => {
    for (const to of ["rascunho", "publicado", "em_avaliacao"] as const) {
      expect(canTransition("encerrado", to)).toBe(false);
    }
  });

  it("fecha automaticamente só editais publicados com prazo vencido", () => {
    const fim = 1_000;
    expect(shouldAutoClose("publicado", fim, fim + 1)).toBe(true);
    expect(shouldAutoClose("publicado", fim, fim)).toBe(false);
    expect(shouldAutoClose("rascunho", fim, fim + 1)).toBe(false);
  });
});

describe("RN02: edição por situação", () => {
  it("rascunho é editável, publicado só prorroga, depois bloqueia", () => {
    expect(editMode("rascunho")).toBe("completo");
    expect(editMode("publicado")).toBe("somente-prazo");
    expect(editMode("em_avaliacao")).toBe("bloqueado");
    expect(editMode("encerrado")).toBe("bloqueado");
  });
});

describe("RN04: lista pública", () => {
  it("mostra só inscrições abertas e em análise", () => {
    expect(isPublic("publicado")).toBe(true);
    expect(isPublic("em_avaliacao")).toBe(true);
    expect(isPublic("rascunho")).toBe(false);
    expect(isPublic("encerrado")).toBe(false);
  });
});

describe("formatação", () => {
  it("numera editais por ano com 3 dígitos", () => {
    expect(formatNumero(3, 2026)).toBe("003/2026");
  });

  it("soma cotas", () => {
    expect(totalCotas(valido.cotasPorArea)).toEqual({ total: 15, ocupadas: 0 });
  });

  it("formata datas no fuso de Brasília, mesmo quando o UTC já virou o dia", () => {
    // 01/11/2026 23:59 em Brasília = 02/11/2026 02:59 UTC
    expect(formatData(Date.UTC(2026, 10, 2, 2, 59))).toBe("01/11/2026");
  });
});

describe("compatibilidade com editais da S3", () => {
  it("usa as cotas por área quando existem", () => {
    expect(cotasDoEdital({ cotasPorArea: valido.cotasPorArea, totalCotas: 99 })).toBe(
      valido.cotasPorArea,
    );
  });

  it("converte o total legado em uma linha única", () => {
    expect(cotasDoEdital({ totalCotas: 20 })).toEqual([
      { area: AREA_LEGADO, total: 20, ocupadas: 0 },
    ]);
  });

  it("devolve lista vazia sem nenhuma informação de cota", () => {
    expect(cotasDoEdital({})).toEqual([]);
  });
});
