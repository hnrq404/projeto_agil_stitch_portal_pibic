import { describe, expect, it } from "vitest";
import {
  etapaAnexosSchema,
  etapaDadosSchema,
  etapaProjetoSchema,
} from "../../src/features/inscricao/schemas";

const dadosValidos = {
  editalId: "edital_1",
  titulo: "Nanocompósitos aplicados à remediação de efluentes têxteis",
  areaCnpq: "1.00.00.00-3 — Ciências Exatas e da Terra",
  resumo: "r".repeat(60),
  palavrasChave: ["materiais", "efluentes", "sustentabilidade"],
  orientadorId: "docente_1",
};

describe("etapaDadosSchema (S3.1 — validação por etapa)", () => {
  it("aceita dados completos", () => {
    expect(etapaDadosSchema.safeParse(dadosValidos).success).toBe(true);
  });

  it("exige título com ao menos 10 caracteres", () => {
    const r = etapaDadosSchema.safeParse({ ...dadosValidos, titulo: "curto" });
    expect(r.success).toBe(false);
  });

  it("exige ao menos 3 palavras-chave não vazias", () => {
    const r = etapaDadosSchema.safeParse({
      ...dadosValidos,
      palavrasChave: ["a", "", " "],
    });
    expect(r.success).toBe(false);
  });

  it("exige orientador selecionado", () => {
    const r = etapaDadosSchema.safeParse({ ...dadosValidos, orientadorId: "" });
    expect(r.success).toBe(false);
  });
});

describe("etapaProjetoSchema", () => {
  it("exige metodologia com ao menos 100 caracteres", () => {
    const r = etapaProjetoSchema.safeParse({ metodologia: "curto", cronograma: "c".repeat(60) });
    expect(r.success).toBe(false);
  });

  it("aceita projeto dentro das regras", () => {
    const r = etapaProjetoSchema.safeParse({
      metodologia: "m".repeat(120),
      cronograma: "c".repeat(60),
    });
    expect(r.success).toBe(true);
  });
});

describe("etapaAnexosSchema", () => {
  it("exige plano de trabalho", () => {
    expect(etapaAnexosSchema.safeParse({ planoTrabalhoFileId: "" }).success).toBe(false);
  });

  it("Lattes é opcional", () => {
    expect(
      etapaAnexosSchema.safeParse({ planoTrabalhoFileId: "arquivo_1" }).success,
    ).toBe(true);
  });
});
