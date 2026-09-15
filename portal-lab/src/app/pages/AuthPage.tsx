import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ROLES, ROLE, ROLE_LABELS } from "../../../convex/roles";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { FullScreenSpinner } from "../Spinner";
import { HOME_BY_ROLE } from "../layout/nav";

type Mode = "login" | "register";

type AuthPageProps = { mode: Mode };

const DEPARTAMENTOS = [
  "ICEx — Inst. de Ciências Exatas (DCC, MAT, FIS)",
  "ICB — Inst. de Ciências Biológicas",
  "FAFICH — Filosofia e Ciências Humanas",
  "Escola de Engenharia",
  "Faculdade de Medicina",
];

const AREAS_CNPQ = [
  "Ciências Exatas e da Terra",
  "Ciências Biológicas",
  "Engenharias",
  "Ciências da Saúde",
  "Ciências Humanas e Sociais",
];

/** Papéis solicitáveis no cadastro (gestor entra na fila de homologação). */
const PAPEIS_SOLICITAVEIS = [ROLE.ALUNO, ROLE.DOCENTE, ROLE.AVALIADOR] as const;

export function AuthPage({ mode }: AuthPageProps) {
  const { signIn } = useAuthActions();
  const location = useLocation();
  const { isLoading, isAuthenticated, user } = useCurrentUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(false);

  // Campos de cadastro
  const [name, setName] = useState("");
  const [matricula, setMatricula] = useState("");
  const [departamento, setDepartamento] = useState(DEPARTAMENTOS[0]);
  const [areaCnpq, setAreaCnpq] = useState(AREAS_CNPQ[0]);
  const [papelSolicitado, setPapelSolicitado] = useState<string>(ROLE.ALUNO);

  const from = (location.state as { from?: string } | null)?.from;

  // Após signIn/signUp, o armazenamento dos tokens é assíncrono: aguardamos
  // o estado de autenticação mudar e só então redirecionamos (sem corrida).
  if (submitting && !isAuthenticated) {
    return <FullScreenSpinner label="Entrando no portal…" />;
  }
  if (!isLoading && user) {
    const target = from ?? HOME_BY_ROLE[user.papel] ?? "/";
    return <Navigate to={target} replace />;
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn("password", { email, password, flow: "signIn" });
      // Sucesso: o redirect acontece via estado (`user` carregado pela query).
    } catch {
      setSubmitting(false);
      setError("E-mail ou senha inválidos. Verifique suas credenciais institucionais.");
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!agree) {
      setError("É necessário declarar veracidade das informações para concluir o cadastro.");
      return;
    }
    setSubmitting(true);
    try {
      // O Convex Auth autentica o novo usuário automaticamente após o signUp;
      // o redirect ocorre pelo estado quando `me` carregar.
      await signIn("password", {
        flow: "signUp",
        email,
        password,
        name,
        matricula,
        departamento,
        areaCnpq,
        papelSolicitado,
      });
    } catch (err) {
      setSubmitting(false);
      const message =
        err instanceof Error ? err.message : "Não foi possível concluir o cadastro.";
      setError(cleanAuthError(message));
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* Faixa institucional (mockup — header do portal) */}
      <header className="bg-navy py-2 text-white">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-2 px-4 lg:px-8">
          <p className="flex items-center gap-2 text-xs">
            <span aria-hidden="true" className="material-symbols-outlined text-[14px] text-teal-soft">
              campaign
            </span>
            <strong>Edital PIBIC 2024/2025</strong> — Período de Submissão e Cartas de Interesse Aberto
          </p>
          <p className="hidden text-xs opacity-80 md:block">
            Prazo final: 31 de Outubro de 2024 · Baixar Edital em PDF
          </p>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-2 px-4 py-4 lg:px-8">
        <a href="/" className="flex items-center gap-2" aria-label="Página inicial do Portal PIBIC">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy font-display text-sm font-bold text-white"
          >
            P
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-display text-base font-bold text-navy">Portal PIBIC</span>
            <span className="text-[11px] text-muted">Portal de Iniciação Científica & Inovação</span>
          </span>
        </a>
        <span className="hidden items-center gap-2 text-xs text-muted sm:flex">
          <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-teal">
            verified_user
          </span>
          RBAC v2.4 · Segurança RNF03
        </span>
      </div>

      <main className="mx-auto w-full max-w-[1280px] px-4 pb-16 lg:px-8">
        <section className="mb-8 flex flex-col gap-2">
          <h1 className="font-display text-3xl font-bold tracking-tight text-navy md:text-4xl">
            {mode === "login" ? "Portal de Acesso Seguro" : "Cadastro Institucional"}
          </h1>
          <p className="max-w-3xl text-sm text-muted">
            {mode === "login"
              ? "Acesse com sua credencial institucional. Cada papel enxerga apenas os módulos que lhe competem (RN11)."
              : "Preencha os dados oficiais de vínculo. Alunos são liberados automaticamente; docentes e avaliadores passam por homologação da PRPq."}
          </p>
        </section>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Coluna esquerda: formulários */}
          <div className="flex flex-col gap-6 lg:col-span-7">
            {/* Alternador de abas */}
            <div className="flex items-center gap-1 rounded-xl bg-hairline p-1">
              <a
                href="/login"
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                  mode === "login" ? "bg-card text-navy shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">lock_open</span>
                Entrar no Sistema (Login)
              </a>
              <a
                href="/cadastro"
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                  mode === "register" ? "bg-card text-navy shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">person_add</span>
                Criar Nova Conta Institucional
              </a>
            </div>

            {mode === "login" ? (
              <div className="card flex flex-col gap-6 p-6 md:p-8">
                <form className="flex flex-col gap-4" onSubmit={handleSignIn}>
                  {error && <ErrorBox message={error} />}
                  <div className="flex flex-col gap-1">
                    <label className="label" htmlFor="login-email">
                      E-mail Institucional <span className="text-status-bad">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <span aria-hidden="true" className="material-symbols-outlined absolute left-3 text-[20px] text-hairline-strong">
                        mail
                      </span>
                      <input
                        id="login-email"
                        type="email"
                        required
                        autoComplete="email"
                        className="field pl-10"
                        placeholder="identificador@universidade.br"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-muted">
                      Utilize seu login institucional cadastrado no sistema acadêmico central.
                    </p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label className="label" htmlFor="login-password">
                        Senha de Acesso <span className="text-status-bad">*</span>
                      </label>
                      <a className="text-xs text-teal hover:underline" href="/recuperar-senha">
                        Esqueceu sua senha?
                      </a>
                    </div>
                    <div className="relative flex items-center">
                      <span aria-hidden="true" className="material-symbols-outlined absolute left-3 text-[20px] text-hairline-strong">
                        lock
                      </span>
                      <input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete="current-password"
                        className="field pl-10"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                        className="absolute right-3 text-hairline-strong hover:text-ink"
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                          {showPassword ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 text-xs text-muted">
                      <input type="checkbox" className="h-4 w-4 rounded" />
                      Lembrar credencial nesta estação (30 dias)
                    </label>
                    <span className="text-xs text-hairline-strong">Timeout de inatividade: 30m</span>
                  </div>

                  <button
                    type="submit"
                    className="btn-primary w-full"
                    disabled={submitting}
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[20px]">login</span>
                    {submitting ? "Entrando…" : "Entrar com Credencial Institucional"}
                  </button>
                </form>

                <div className="flex items-center gap-3 text-xs text-muted">
                  <div className="h-px flex-1 bg-hairline" />
                  <span>OU AUTENTIQUE-SE POR FEDERAÇÃO OFICIAL</span>
                  <div className="h-px flex-1 bg-hairline" />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button type="button" className="btn-secondary" disabled title="Integração prevista para S7">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-navy text-[11px] font-bold text-white">gov</span>
                    Entrar com gov.br
                  </button>
                  <button type="button" className="btn-secondary" disabled title="Integração prevista para S7">
                    <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-teal">hub</span>
                    Comunidade CAFe / RNP
                  </button>
                </div>
              </div>
            ) : (
              <div className="card flex flex-col gap-6 p-6 md:p-8">
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-bold text-navy">Cadastro de Usuário Institucional</h2>
                  <p className="text-xs text-muted">
                    Todos os campos marcados com <span className="text-status-bad">*</span> são obrigatórios (CNPq/Lattes).
                  </p>
                </div>

                <form className="flex flex-col gap-4" onSubmit={handleSignUp}>
                  {error && <ErrorBox message={error} />}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label className="label" htmlFor="reg-name">Nome Completo <span className="text-status-bad">*</span></label>
                      <input
                        id="reg-name"
                        className="field"
                        required
                        placeholder="Ex: Profa. Mariana Silva"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="label" htmlFor="reg-matricula">Matrícula / SIAPE <span className="text-status-bad">*</span></label>
                      <input
                        id="reg-matricula"
                        className="field"
                        required
                        placeholder="Ex: 2021049281 ou SIAPE 1984210"
                        value={matricula}
                        onChange={(e) => setMatricula(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label className="label" htmlFor="reg-email">E-mail Institucional <span className="text-status-bad">*</span></label>
                      <input
                        id="reg-email"
                        type="email"
                        className="field"
                        required
                        placeholder="nome.sobrenome@universidade.br"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="label" htmlFor="reg-password">
                        Senha <span className="text-status-bad">*</span>
                      </label>
                      <input
                        id="reg-password"
                        type="password"
                        className="field"
                        required
                        autoComplete="new-password"
                        placeholder="8+ caracteres, maiúscula, minúscula e número"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label className="label" htmlFor="reg-depto">Vínculo Acadêmico (Unidade/Centro) <span className="text-status-bad">*</span></label>
                      <select
                        id="reg-depto"
                        className="field"
                        value={departamento}
                        onChange={(e) => setDepartamento(e.target.value)}
                      >
                        {DEPARTAMENTOS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="label" htmlFor="reg-area">Grande Área CNPq <span className="text-status-bad">*</span></label>
                      <select
                        id="reg-area"
                        className="field"
                        value={areaCnpq}
                        onChange={(e) => setAreaCnpq(e.target.value)}
                      >
                        {AREAS_CNPQ.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="label">Perfil Solicitado <span className="text-status-bad">*</span></span>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {PAPEIS_SOLICITAVEIS.map((r) => (
                        <label
                          key={r}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 transition-colors ${
                            papelSolicitado === r ? "border-navy bg-canvas" : "border-hairline bg-card hover:bg-canvas"
                          }`}
                        >
                          <input
                            type="radio"
                            name="papel"
                            className="h-4 w-4"
                            checked={papelSolicitado === r}
                            onChange={() => setPapelSolicitado(r)}
                          />
                          <span className="flex flex-col">
                            <span className="text-xs font-bold text-navy">{ROLE_LABELS[r]}</span>
                            <span className="text-[11px] text-muted">
                              {r === ROLE.ALUNO ? "Liberação automática" : "Homologação da PRPq"}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <input
                      id="reg-terms"
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={agree}
                      onChange={(e) => setAgree(e.target.checked)}
                    />
                    <label htmlFor="reg-terms" className="text-xs text-muted">
                      Declaro sob as penas da lei que todas as informações prestadas são verdadeiras e
                      estou em conformidade com o regulamento do PIBIC/PRPq.
                    </label>
                  </div>

                  <button type="submit" className="w-full bg-teal text-white" disabled={submitting}
                    style={{ height: 40, borderRadius: 8, fontWeight: 600 }}>
                    <span aria-hidden="true" className="material-symbols-outlined text-[20px]">how_to_reg</span>
                    {submitting ? "Enviando…" : "Finalizar Cadastro Institucional"}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Coluna direita: cards informativos */}
          <aside className="flex flex-col gap-6 lg:col-span-5">
            <div className="card flex flex-col gap-4 p-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-teal">Rede Acadêmica Conectada</span>
                <span className="text-xs text-muted">Edital 2024/2025</span>
              </div>
              <div className="relative h-44 overflow-hidden rounded-lg bg-navy">
                <div className="absolute inset-0 flex flex-col justify-end p-4 text-white">
                  <span className="font-display text-base font-bold">Inovação, Ciência & Transparência</span>
                  <span className="text-xs opacity-85">Mais de 1.840 pesquisadores e acadêmicos ativos</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-hairline pt-4 text-center">
                <div className="rounded bg-canvas p-2">
                  <span className="block font-display text-lg font-bold text-navy">1.420</span>
                  <span className="block text-[11px] text-muted">Alunos</span>
                </div>
                <div className="rounded bg-canvas p-2">
                  <span className="block font-display text-lg font-bold text-teal">386</span>
                  <span className="block text-[11px] text-muted">Docentes</span>
                </div>
                <div className="rounded bg-canvas p-2">
                  <span className="block font-display text-lg font-bold text-navy">34</span>
                  <span className="block text-[11px] text-muted">Gestores PRPq</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-hairline p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-navy">
                <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-teal">support_agent</span>
                Dúvidas de Acesso?
              </p>
              <p className="text-xs text-muted">
                Caso sua matrícula ou portaria SIAPE não seja validada, encaminhe seus dados funcionais
                para a Secretaria de Iniciação Científica.
              </p>
              <p className="font-mono text-xs font-bold text-navy">pibic.suporte@prpq.universidade.br</p>
            </div>
          </aside>
        </div>

        {/* Matriz RBAC resumida */}
        <section className="mt-12 flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold text-navy">Matriz de Acessos por Papel (RN11)</h2>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-navy text-white">
                    <th className="px-6 py-3 font-semibold">Funcionalidade</th>
                    {ROLES.map((r) => (
                      <th key={r} className="px-4 py-3 text-center font-semibold">{ROLE_LABELS[r]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {[
                    { f: "Vitrine Pública & Busca", perms: ["vitrine", "vitrine", "vitrine", "vitrine"] },
                    { f: "Submissão de Inscrição", perms: ["nova-inscricao", "nova-inscricao", null, "nova-inscricao"] },
                    { f: "Gestão de Meus Projetos", perms: [null, "meus-projetos", null, null] },
                    { f: "Central de Triagem Geral", perms: ["triagem", null, "triagem", null] },
                    { f: "Painel & Métricas (PRPq)", perms: ["dashboard", null, null, null] },
                    { f: "Gestão de Usuários/Papéis", perms: ["gestao-usuarios", null, null, null] },
                  ].map((row) => (
                    <tr key={row.f} className="hover:bg-canvas">
                      <td className="px-6 py-3 font-semibold text-navy">{row.f}</td>
                      {row.perms.map((p, i) => (
                        <td key={i} className="px-4 py-3 text-center">
                          {p ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-teal">
                              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">check_circle</span>
                              Liberado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-hairline-strong">
                              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">block</span>
                              —
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-status-bad-border bg-status-bad-bg p-3 text-xs text-ink" role="alert">
      <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-status-bad">error</span>
      <span>{message}</span>
    </div>
  );
}

function cleanAuthError(message: string): string {
  if (message.includes("Invalid credentials") || message.includes("invalid")) {
    return "Credenciais inválidas ou conta já existente. Verifique os dados informados.";
  }
  if (message.includes("Acesso restrito")) return message;
  return message;
}
