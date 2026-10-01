/**
 * Grandes áreas CNPq aceitas pelo portal. Fonte única usada no cadastro de
 * usuários e nas cotas por área dos editais.
 */
export const AREAS_CNPQ = [
  "Ciências Exatas e da Terra",
  "Ciências Biológicas",
  "Engenharias",
  "Ciências da Saúde",
  "Ciências Humanas e Sociais",
] as const;

export type AreaCnpq = (typeof AREAS_CNPQ)[number];
