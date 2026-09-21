/**
 * Regras de negócio puras do módulo de inscrições (S3) — sem dependências do
 * runtime Convex, reutilizadas pelo backend (mutations) e pelo frontend
 * (validação imediata no formulário) e testadas unitariamente.
 */

/** RN06 / RNF09: anexos apenas em PDF e até 10 MB. */
export const MAX_ANEXO_BYTES = 10 * 1024 * 1024;

/**
 * RN02 — prazo do edital: criação de rascunho e submissão exigem edital
 * publicado e dentro do período de inscrições. Pura para teste unitário.
 */
export function editalEncerrado(
  edital: { status: string; dataAbertura: number; dataEncerramento: number },
  agora: number,
): boolean {
  return (
    edital.status !== "publicado" ||
    agora < edital.dataAbertura ||
    agora > edital.dataEncerramento
  );
}

export function validarAnexo(input: { nome: string; mimeType: string; tamanho: number }): string | null {
  const nome = input.nome.toLowerCase();
  const ehPdf = input.mimeType === "application/pdf" || nome.endsWith(".pdf");
  if (!ehPdf) {
    return "Formato inválido: apenas arquivos PDF são aceitos (RN06).";
  }
  if (input.tamanho <= 0) {
    return "Arquivo vazio ou corrompido. Gere o PDF novamente.";
  }
  if (input.tamanho > MAX_ANEXO_BYTES) {
    return "Arquivo acima do limite de 10 MB (RN06). Reduza ou compacte o PDF e tente novamente.";
  }
  return null;
}

export type DadosSubmissao = {
  titulo: string;
  areaCnpq: string;
  resumo: string;
  metodologia?: string;
  cronograma?: string;
  palavrasChave: string[];
  orientadorId?: string | null;
  orientadorStatus?: string | null;
  planoTrabalhoFileId?: string | null;
};

/**
 * Pendências que bloqueiam a submissão (S3.3): proposta completa exige
 * orientador vinculado E aprovado (carta-aceite) + plano de trabalho anexado.
 */
export function pendenciasSubmissao(dados: DadosSubmissao): string[] {
  const pendencias: string[] = [];
  if (dados.titulo.trim().length < 10) {
    pendencias.push("Título da proposta (mínimo de 10 caracteres).");
  }
  if (!dados.areaCnpq.trim()) {
    pendencias.push("Grande área CNPq não selecionada.");
  }
  if (dados.resumo.trim().length < 50) {
    pendencias.push("Resumo (mínimo de 50 caracteres).");
  }
  if (!dados.metodologia || dados.metodologia.trim().length < 100) {
    pendencias.push("Metodologia (mínimo de 100 caracteres).");
  }
  if (!dados.cronograma || dados.cronograma.trim().length < 50) {
    pendencias.push("Cronograma (mínimo de 50 caracteres).");
  }
  if (dados.palavrasChave.filter((p) => p.trim().length > 0).length < 3) {
    pendencias.push("Ao menos 3 palavras-chave.");
  }
  if (!dados.orientadorId) {
    pendencias.push("Professor orientador vinculado.");
  } else if (dados.orientadorStatus !== "aprovado") {
    pendencias.push("Aprovação (carta-aceite) do professor orientador.");
  }
  if (!dados.planoTrabalhoFileId) {
    pendencias.push("Plano de trabalho em PDF anexado.");
  }
  return pendencias;
}
