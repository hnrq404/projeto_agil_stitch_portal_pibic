import { describe, expect, it } from "vitest";
import { PROTOCOLO_REGEX, gerarProtocolo } from "../../convex/inscricoes/protocolo";
import {
  MAX_ANEXO_BYTES,
  editalEncerrado,
  pendenciasSubmissao,
  validarAnexo,
} from "../../convex/inscricoes/regras";

describe("editalEncerrado (RN02 — prazo do edital)", () => {
  const abertura = new Date("2026-10-01T00:00:00Z").getTime();
  const encerramento = new Date("2026-11-05T23:59:59Z").getTime();
  const edital = { status: "publicado", dataAbertura: abertura, dataEncerramento: encerramento };

  it("aceita dentro do período de inscrições", () => {
    const agora = new Date("2026-10-20T12:00:00Z").getTime();
    expect(editalEncerrado(edital, agora)).toBe(false);
  });

  it("rejeita após o encerramento (submissão tardia de rascunho)", () => {
    const agora = encerramento + 1;
    expect(editalEncerrado(edital, agora)).toBe(true);
  });

  it("rejeita antes da abertura", () => {
    expect(editalEncerrado(edital, abertura - 1)).toBe(true);
  });

  it("rejeita edital não publicado", () => {
    expect(editalEncerrado({ ...edital, status: "encerrado" }, abertura + 1000)).toBe(true);
    expect(editalEncerrado({ ...edital, status: "rascunho" }, abertura + 1000)).toBe(true);
  });
});

describe("gerarProtocolo (S3 — protocolo único no backend)", () => {
  it("segue o formato CNPq 23076.014821/2026-11", () => {
    const p = gerarProtocolo(new Date("2026-11-05T12:00:00Z").getTime(), () => 0.42);
    expect(p).toMatch(PROTOCOLO_REGEX);
    expect(p.startsWith(".")).toBe(false);
  });

  it("incorpora ano e mês da data informada", () => {
    const p = gerarProtocolo(new Date("2026-11-05T12:00:00Z").getTime(), () => 0.99);
    expect(p).toContain("/2026-11");
  });

  it("determinístico com rand semeado", () => {
    let chamadas = 0;
    const rand = () => {
      chamadas++;
      return chamadas === 1 ? 0.1 : 0.2;
    };
    const a = gerarProtocolo(0, rand);
    const b = gerarProtocolo(0, rand);
    expect(a).not.toBe(b);
  });
});

describe("validarAnexo (RN06/RNF09 — PDF até 10 MB)", () => {
  it("aceita PDF dentro do limite", () => {
    expect(
      validarAnexo({ nome: "plano.pdf", mimeType: "application/pdf", tamanho: 1024 * 1024 }),
    ).toBeNull();
  });

  it("rejeita não-PDF mesmo com extensão trocada", () => {
    expect(
      validarAnexo({ nome: "plano.docx", mimeType: "application/msword", tamanho: 1000 }),
    ).toMatch(/apenas arquivos PDF/i);
  });

  it("aceita PDF identificado só pela extensão (mimeType vazio)", () => {
    expect(validarAnexo({ nome: "lattes.PDF", mimeType: "", tamanho: 500 })).toBeNull();
  });

  it("rejeita arquivo acima de 10 MB", () => {
    expect(
      validarAnexo({ nome: "grande.pdf", mimeType: "application/pdf", tamanho: MAX_ANEXO_BYTES + 1 }),
    ).toMatch(/10 MB/i);
  });

  it("rejeita arquivo vazio", () => {
    expect(validarAnexo({ nome: "vazio.pdf", mimeType: "application/pdf", tamanho: 0 })).toMatch(
      /vazio/i,
    );
  });
});

describe("pendenciasSubmissao (S3.3 — proposta completa)", () => {
  const base = {
    titulo: "Nanocompósitos aplicados à remediação de efluentes têxteis",
    areaCnpq: "1.00.00.00-3 — Ciências Exatas e da Terra",
    resumo: "x".repeat(60),
    metodologia: "m".repeat(120),
    cronograma: "c".repeat(60),
    palavrasChave: ["materiais", "efluentes", "sustentabilidade"],
    orientadorId: "user_docente",
    orientadorStatus: "aprovado",
    planoTrabalhoFileId: "arquivo_1",
  };

  it("proposta completa não gera pendências", () => {
    expect(pendenciasSubmissao(base)).toEqual([]);
  });

  it("exige orientador vinculado", () => {
    const pend = pendenciasSubmissao({ ...base, orientadorId: null });
    expect(pend.some((p) => /orientador/i.test(p))).toBe(true);
  });

  it("exige aceite do orientador (carta-aceite)", () => {
    const pend = pendenciasSubmissao({ ...base, orientadorStatus: "pendente" });
    expect(pend.some((p) => /aprova/i.test(p))).toBe(true);
  });

  it("exige plano de trabalho anexado", () => {
    const pend = pendenciasSubmissao({ ...base, planoTrabalhoFileId: null });
    expect(pend.some((p) => /plano de trabalho/i.test(p))).toBe(true);
  });

  it("exige ao menos 3 palavras-chave", () => {
    const pend = pendenciasSubmissao({ ...base, palavrasChave: ["uma"] });
    expect(pend.some((p) => /palavras-chave/i.test(p))).toBe(true);
  });

  it("exige metodologia e cronograma mínimos", () => {
    const pend = pendenciasSubmissao({ ...base, metodologia: "curto", cronograma: "" });
    expect(pend.some((p) => /metodologia/i.test(p))).toBe(true);
    expect(pend.some((p) => /cronograma/i.test(p))).toBe(true);
  });
});
