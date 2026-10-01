/**
 * Requisitos de senha — fonte única usada pela validação do backend
 * (`auth.ts`) e pelo checklist em tempo real do cadastro (Nielsen #5/#6:
 * o usuário vê as regras enquanto digita, em vez de descobri-las no erro).
 */
export const PASSWORD_RULES = [
  { id: "len", label: "Pelo menos 8 caracteres", test: (p: string) => p.length >= 8 },
  { id: "lower", label: "Uma letra minúscula", test: (p: string) => /[a-z]/.test(p) },
  { id: "upper", label: "Uma letra maiúscula", test: (p: string) => /[A-Z]/.test(p) },
  { id: "digit", label: "Um número", test: (p: string) => /\d/.test(p) },
] as const;

export function passwordIssues(password: string): string[] {
  return PASSWORD_RULES.filter((r) => !r.test(password)).map((r) => r.label);
}
