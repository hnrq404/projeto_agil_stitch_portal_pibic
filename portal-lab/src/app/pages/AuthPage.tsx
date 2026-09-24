import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { AREAS_CNPQ } from "../../../convex/areas";
import { PASSWORD_RULES, passwordIssues } from "../../../convex/passwordRules";
import { ROLE, ROLE_LABELS } from "../../../convex/roles";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { friendlyError } from "../../lib/errors";
import { FullScreenSpinner } from "../Spinner";
import { HOME_BY_ROLE } from "../layout/nav";
import { Alert } from "../ui/Alert";

type Mode = "login" | "register";

type AuthPageProps = { mode: Mode };

const DEPARTAMENTOS = [
  "ICEx — Inst. de Ciências Exatas (DCC, MAT, FIS)",
  "ICB — Inst. de Ciências Biológicas",
  "FAFICH — Filosofia e Ciências Humanas",
  "Escola de Engenharia",
  "Faculdade de Medicina",
];

/** Papéis solicitáveis no cadastro (gestor entra na fila de homologação). */
const PAPEIS_SOLICITAVEIS = [ROLE.ALUNO, ROLE.DOCENTE, ROLE.AVALIADOR] as const;

const PAPEL_HINT: Record<(typeof PAPEIS_SOLICITAVEIS)[number], string> = {
  aluno: "Liberado na hora",
  docente: "Precisa de aprovação da PRPq",
  avaliador: "Precisa de aprovação da PRPq",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RegisterField = "name" | "matricula" | "email" | "password" | "agree";

/**
 * Nielsen #5 — validação no próprio campo, antes do envio, com as mesmas
 * regras do backend. Retorna apenas os campos com problema.
 */
function validateRegister(v: {
  name: string;
  matricula: string;
  email: string;
  password: string;
  agree: boolean;
}): Partial<Record<RegisterField, string>> {
  const errors: Partial<Record<RegisterField, string>> = {};
  if (v.name.trim().length < 3) errors.name = "Informe seu nome completo.";
  if (v.matricula.trim().length < 5)
    errors.matricula = "Informe a matrícula ou o SIAPE (mínimo 5 dígitos).";
  if (!EMAIL_RE.test(v.email.trim()))
    errors.email = "Use um e-mail no formato nome@universidade.br.";
  if (passwordIssues(v.password).length > 0)
    errors.password = "A senha ainda não atende a todos os requisitos abaixo.";
  if (!v.agree) errors.agree = "Marque a declaração para concluir o cadastro.";
  return errors;
}

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
  const [areaCnpq, setAreaCnpq] = useState<string>(AREAS_CNPQ[0]);
  const [papelSolicitado, setPapelSolicitado] = useState<string>(ROLE.ALUNO);
  const [touched, setTouched] = useState<Partial<Record<RegisterField, boolean>>>({});

  const from = (location.state as { from?: string } | null)?.from;
  const fieldErrors = validateRegister({ name, matricula, email, password, agree });
  const showError = (f: RegisterField) => (touched[f] ? fieldErrors[f] : undefined);
  const touch = (f: RegisterField) => () => setTouched((t) => ({ ...t, [f]: true }));

  // Após signIn/signUp, o armazenamento dos tokens é assíncrono: aguardamos
  // o estado de autenticação mudar e só então redirecionamos (sem corrida).
  if (submitting && !isAuthenticated) {
    return (
      <FullScreenSpinner label={mode === "login" ? "Entrando no portal…" : "Criando sua conta…"} />
    );
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
      await signIn("password", { email: email.trim(), password, flow: "signIn" });
      // Sucesso: o redirect acontece via estado (`user` carregado pela query).
    } catch (err) {
      setSubmitting(false);
      setError(
        friendlyError(
          err,
          "Não foi possível entrar agora. Confira seu e-mail e senha e tente novamente.",
        ),
      );
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (Object.keys(fieldErrors).length > 0) {
      setTouched({ name: true, matricula: true, email: true, password: true, agree: true });
      setError(
        "Alguns campos precisam de ajuste — veja as mensagens em vermelho abaixo de cada um.",
      );
      return;
    }
    setSubmitting(true);
    try {
      // O Convex Auth autentica o novo usuário automaticamente após o signUp;
      // o redirect ocorre pelo estado quando `me` carregar.
      await signIn("password", {
        flow: "signUp",
        email: email.trim(),
        password,
        name: name.trim(),
        matricula: matricula.trim(),
        departamento,
        areaCnpq,
        papelSolicitado,
      });
    } catch (err) {
      setSubmitting(false);
      setError(
        friendlyError(
          err,
          "Não foi possível concluir o cadastro agora. Tente novamente em instantes.",
        ),
      );
    }
  }

  const tabClass = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
      active ? "bg-card text-navy shadow-sm" : "text-muted hover:text-ink"
    }`;

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-2 px-4 py-4 lg:px-8">
        <Link
          to="/"
          className="flex items-center gap-2"
          aria-label="Página inicial do Portal PIBIC"
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy font-display text-sm font-bold text-white"
          >
            P
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-display text-base font-bold text-navy">Portal PIBIC</span>
            <span className="text-[11px] text-muted">
              Portal de Iniciação Científica & Inovação
            </span>
          </span>
        </Link>
        <Link to="/ajuda" className="flex items-center gap-1 text-sm text-teal hover:underline">
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
            help
          </span>
          Ajuda
        </Link>
      </div>

      <main className="mx-auto w-full max-w-[1280px] px-4 pb-16 lg:px-8">
        <section className="mb-8 flex flex-col gap-2">
          <h1 className="font-display text-3xl font-bold tracking-tight text-navy md:text-4xl">
            {mode === "login" ? "Entrar no Portal PIBIC" : "Criar conta no Portal PIBIC"}
          </h1>
          <p className="max-w-3xl text-sm text-muted">
            {mode === "login"
              ? "Use o e-mail e a senha cadastrados no portal. Depois de entrar, você verá apenas as áreas do seu perfil."
              : "Preencha seus dados de vínculo com a universidade. Alunos já podem usar o portal logo após o cadastro; docentes e avaliadores aguardam aprovação da PRPq."}
          </p>
        </section>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Coluna esquerda: formulários */}
          <div className="flex flex-col gap-6 lg:col-span-7">
            <nav
              aria-label="Entrar ou criar conta"
              className="flex items-center gap-1 rounded-xl bg-hairline p-1"
            >
              <Link
                to="/login"
                state={location.state}
                className={tabClass(mode === "login")}
                aria-current={mode === "login" ? "page" : undefined}
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                  lock_open
                </span>
                Entrar
              </Link>
              <Link
                to="/cadastro"
                state={location.state}
                className={tabClass(mode === "register")}
                aria-current={mode === "register" ? "page" : undefined}
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                  person_add
                </span>
                Criar conta
              </Link>
            </nav>

            {from && (
              <Alert tone="info">Entre para continuar para a página que você tentou abrir.</Alert>
            )}

            {mode === "login" ? (
              <div className="card flex flex-col gap-6 p-6 md:p-8">
                <form className="flex flex-col gap-4" onSubmit={handleSignIn}>
                  {error && (
                    <Alert tone="error" title="Não foi possível entrar">
                      {error}
                    </Alert>
                  )}
                  <div className="flex flex-col gap-1">
                    <label className="label" htmlFor="login-email">
                      E-mail institucional <span className="text-status-bad">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <span
                        aria-hidden="true"
                        className="material-symbols-outlined absolute left-3 text-[20px] text-hairline-strong"
                      >
                        mail
                      </span>
                      <input
                        id="login-email"
                        type="email"
                        required
                        autoFocus
                        autoComplete="email"
                        className="field pl-10"
                        placeholder="nome@universidade.br"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label className="label" htmlFor="login-password">
                        Senha <span className="text-status-bad">*</span>
                      </label>
                      <Link className="text-xs text-teal hover:underline" to="/recuperar-senha">
                        Esqueceu sua senha?
                      </Link>
                    </div>
                    <PasswordInput
                      id="login-password"
                      autoComplete="current-password"
                      value={password}
                      onChange={setPassword}
                      show={showPassword}
                      onToggle={() => setShowPassword((v) => !v)}
                    />
                  </div>

                  <p className="flex items-center gap-1 text-xs text-muted">
                    <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
                      schedule
                    </span>
                    Por segurança, a sessão é encerrada após 30 minutos sem uso.
                  </p>

                  <button type="submit" className="btn-primary w-full" disabled={submitting}>
                    <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
                      login
                    </span>
                    {submitting ? "Entrando…" : "Entrar"}
                  </button>
                </form>
              </div>
            ) : (
              <div className="card flex flex-col gap-6 p-6 md:p-8">
                <p className="text-xs text-muted">
                  Campos marcados com <span className="text-status-bad">*</span> são obrigatórios.
                </p>

                <form className="flex flex-col gap-4" onSubmit={handleSignUp} noValidate>
                  {error && (
                    <Alert tone="error" title="Cadastro não concluído">
                      {error}
                    </Alert>
                  )}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field id="reg-name" label="Nome completo" error={showError("name")}>
                      <input
                        id="reg-name"
                        className="field"
                        autoComplete="name"
                        placeholder="Ex.: Mariana Silva"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={touch("name")}
                        aria-invalid={!!showError("name")}
                        aria-describedby={showError("name") ? "reg-name-error" : undefined}
                      />
                    </Field>
                    <Field
                      id="reg-matricula"
                      label="Matrícula ou SIAPE"
                      hint="Alunos: matrícula. Servidores: número SIAPE."
                      error={showError("matricula")}
                    >
                      <input
                        id="reg-matricula"
                        className="field"
                        inputMode="numeric"
                        placeholder="Ex.: 2021049281"
                        value={matricula}
                        onChange={(e) => setMatricula(e.target.value)}
                        onBlur={touch("matricula")}
                        aria-invalid={!!showError("matricula")}
                        aria-describedby={
                          showError("matricula") ? "reg-matricula-error" : "reg-matricula-hint"
                        }
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field id="reg-email" label="E-mail institucional" error={showError("email")}>
                      <input
                        id="reg-email"
                        type="email"
                        className="field"
                        autoComplete="email"
                        placeholder="nome.sobrenome@universidade.br"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={touch("email")}
                        aria-invalid={!!showError("email")}
                        aria-describedby={showError("email") ? "reg-email-error" : undefined}
                      />
                    </Field>
                    <Field id="reg-password" label="Senha" error={showError("password")}>
                      <PasswordInput
                        id="reg-password"
                        autoComplete="new-password"
                        value={password}
                        onChange={setPassword}
                        onBlur={touch("password")}
                        show={showPassword}
                        onToggle={() => setShowPassword((v) => !v)}
                        describedBy="reg-password-rules"
                        invalid={!!showError("password")}
                      />
                      {/* Nielsen #6: requisitos visíveis e marcados em tempo real. */}
                      <ul
                        id="reg-password-rules"
                        className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]"
                      >
                        {PASSWORD_RULES.map((r) => {
                          const ok = r.test(password);
                          return (
                            <li
                              key={r.id}
                              className={`flex items-center gap-1 ${ok ? "text-status-ok" : "text-muted"}`}
                            >
                              <span
                                aria-hidden="true"
                                className="material-symbols-outlined text-[14px]"
                              >
                                {ok ? "check_circle" : "radio_button_unchecked"}
                              </span>
                              {r.label}
                              <span className="sr-only">{ok ? "(atendido)" : "(pendente)"}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field id="reg-depto" label="Unidade acadêmica">
                      <select
                        id="reg-depto"
                        className="field"
                        value={departamento}
                        onChange={(e) => setDepartamento(e.target.value)}
                      >
                        {DEPARTAMENTOS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      id="reg-area"
                      label="Grande área do CNPq"
                      hint="A área de conhecimento da sua pesquisa."
                    >
                      <select
                        id="reg-area"
                        className="field"
                        value={areaCnpq}
                        onChange={(e) => setAreaCnpq(e.target.value)}
                        aria-describedby="reg-area-hint"
                      >
                        {AREAS_CNPQ.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <fieldset className="flex flex-col gap-1">
                    <legend className="label mb-1">
                      Como você vai usar o portal? <span className="text-status-bad">*</span>
                    </legend>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {PAPEIS_SOLICITAVEIS.map((r) => (
                        <label
                          key={r}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 transition-colors ${
                            papelSolicitado === r
                              ? "border-navy bg-canvas"
                              : "border-hairline bg-card hover:bg-canvas"
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
                            <span className="text-[11px] text-muted">{PAPEL_HINT[r]}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-start gap-2">
                      <input
                        id="reg-terms"
                        type="checkbox"
                        className="mt-1 h-4 w-4"
                        checked={agree}
                        onChange={(e) => {
                          setAgree(e.target.checked);
                          touch("agree")();
                        }}
                        aria-invalid={!!showError("agree")}
                        aria-describedby={showError("agree") ? "reg-terms-error" : undefined}
                      />
                      <label htmlFor="reg-terms" className="text-xs text-muted">
                        Declaro que as informações acima são verdadeiras e que conheço o regulamento
                        do PIBIC/PRPq.
                      </label>
                    </div>
                    {showError("agree") && (
                      <FieldError id="reg-terms-error">{showError("agree")}</FieldError>
                    )}
                  </div>

                  <button type="submit" className="btn-primary w-full" disabled={submitting}>
                    <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
                      how_to_reg
                    </span>
                    {submitting ? "Criando conta…" : "Criar minha conta"}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Coluna direita: ajuda em contexto (Nielsen #10) */}
          <aside className="flex flex-col gap-6 lg:col-span-5">
            <div className="card flex flex-col gap-3 p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined text-[20px] text-teal"
                >
                  tips_and_updates
                </span>
                {mode === "login" ? "Primeira vez aqui?" : "Como funciona o cadastro"}
              </h2>
              {mode === "login" ? (
                <p className="text-xs text-muted">
                  Você precisa criar uma conta antes de entrar. Leva cerca de 2 minutos —{" "}
                  <Link to="/cadastro" className="text-teal hover:underline">
                    criar conta agora
                  </Link>
                  .
                </p>
              ) : (
                <ol className="list-decimal space-y-1 pl-4 text-xs text-muted">
                  <li>Preencha seus dados e escolha como vai usar o portal.</li>
                  <li>
                    Alunos entram direto; docentes e avaliadores usam o portal como aluno até a
                    aprovação.
                  </li>
                  <li>Você acompanha o pedido por um aviso no topo da tela.</li>
                </ol>
              )}
              <Link to="/ajuda" className="text-xs font-semibold text-teal hover:underline">
                Ver todas as dúvidas frequentes
              </Link>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-hairline p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-navy">
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined text-[20px] text-teal"
                >
                  support_agent
                </span>
                Problemas para acessar?
              </p>
              <p className="text-xs text-muted">
                Se sua matrícula ou SIAPE não for aceita, escreva para a Secretaria de Iniciação
                Científica com seu nome e número de vínculo.
              </p>
              <a
                className="font-mono text-xs font-bold text-navy underline"
                href="mailto:pibic.suporte@prpq.universidade.br"
              >
                pibic.suporte@prpq.universidade.br
              </a>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="label" htmlFor={id}>
        {label} <span className="text-status-bad">*</span>
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-[11px] text-muted">
          {hint}
        </p>
      )}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}

/** Nielsen #9 — erro junto ao campo, em vermelho, com ícone e texto acionável. */
function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-center gap-1 text-[11px] font-semibold text-status-bad">
      <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
        error
      </span>
      {children}
    </p>
  );
}

function PasswordInput({
  id,
  autoComplete,
  value,
  onChange,
  onBlur,
  show,
  onToggle,
  describedBy,
  invalid,
}: {
  id: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  show: boolean;
  onToggle: () => void;
  describedBy?: string;
  invalid?: boolean;
}) {
  return (
    <div className="relative flex items-center">
      <span
        aria-hidden="true"
        className="material-symbols-outlined absolute left-3 text-[20px] text-hairline-strong"
      >
        lock
      </span>
      <input
        id={id}
        type={show ? "text" : "password"}
        required
        autoComplete={autoComplete}
        className="field pl-10 pr-10"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-describedby={describedBy}
        aria-invalid={invalid}
      />
      <button
        type="button"
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={show}
        className="absolute right-3 text-muted hover:text-ink"
        onClick={onToggle}
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
          {show ? "visibility_off" : "visibility"}
        </span>
      </button>
    </div>
  );
}
