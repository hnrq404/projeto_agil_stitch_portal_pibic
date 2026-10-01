/**
 * Validação client-side de Id do Convex na URL (revisão S3): 26–32 bytes
 * lowercase alfanuméricos (base32-like). Com lixo na URL, o validador do
 * backend rejeita a query no cliente antes do handler — melhor responder
 * com uma tela de link inválido do que derrubar a página.
 *
 * Ampla de propósito (aceita k579n5kb099e9syx4bz8mxegw98ev35q etc.): o
 * objetivo é separar lixo evidente de id plausível; a autorização real
 * continua no backend.
 */
export function ehIdConvex(valor: unknown): valor is string {
  return typeof valor === "string" && /^[0-9a-z]{26,32}$/.test(valor);
}
