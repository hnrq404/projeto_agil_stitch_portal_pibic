import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { z } from "zod";
import type { DataModel } from "./_generated/dataModel";
import { ROLE } from "./roles";

/** Papel default de novos cadastros: aluno (liberação automática, RN11). */
export const DEFAULT_ROLE = ROLE.ALUNO;

const passwordSchema = z
  .string()
  .min(8, "A senha deve ter ao menos 8 caracteres")
  .regex(/\d/, "A senha deve conter ao menos um número")
  .regex(/[a-z]/, "A senha deve conter uma letra minúscula")
  .regex(/[A-Z]/, "A senha deve conter uma letra maiúscula");

export const SignUpSchema = z.object({
  email: z.string().email("E-mail institucional inválido"),
  password: passwordSchema,
  name: z.string().min(3, "Informe o nome completo"),
  matricula: z.string().min(5, "Informe a matrícula/SIAPE"),
  departamento: z.string().min(2, "Informe a unidade acadêmica"),
  areaCnpq: z.string().min(2, "Informe a grande área CNPq"),
  papelSolicitado: z.enum(["admin", "docente", "avaliador", "aluno"]),
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
      profile(params) {
        if (params.flow !== "signUp") {
          // signIn / reset: apenas o e-mail é necessário aqui.
          return { email: params.email as string };
        }
        const parsed = SignUpSchema.safeParse(params);
        if (!parsed.success) {
          throw new ConvexError(
            `Dados de cadastro inválidos: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
          );
        }
        const { email, name, matricula, departamento, areaCnpq, papelSolicitado } = parsed.data;
        // Aluno é liberado automaticamente; papéis elevados entram na fila
        // de homologação da PRPq (tela de Gestão de Usuários, S1.2).
        const papeisSolicitados = papelSolicitado === DEFAULT_ROLE ? [] : [papelSolicitado];
        return {
          email,
          name,
          papel: DEFAULT_ROLE,
          matricula,
          departamento,
          areaCnpq,
          papeisSolicitados,
        };
      },
      validatePasswordRequirements: (password: string) => {
        const parsed = passwordSchema.safeParse(password);
        if (!parsed.success) {
          throw new ConvexError(
            `Senha inválida: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
          );
        }
      },
    }),
  ],
});
