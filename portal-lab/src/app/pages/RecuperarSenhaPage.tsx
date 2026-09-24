import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useCurrentUser } from "../../hooks/useCurrentUser";

/**
 * S1.1 — Fluxo de recuperação de senha. O provedor Password do Convex Auth
 * exige um serviço de e-mail (config.reset + Resend) para o fluxo completo
 * de token por e-mail; sem ele, esta tela orienta o procedimento adotado
 * na S1 (reset administrativo via PRPq) conforme o mockup institucional.
 */
export function RecuperarSenhaPage() {
  const { signIn } = useAuthActions();
  const { isLoading, user } = useCurrentUser();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!isLoading && user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      // Fluxo "reset" do provedor Password: se um serviço de e-mail estiver
      // configurado no backend, o token de redefinição é enviado agora.
      await signIn("password", { flow: "reset", email });
      setSent(true);
    } catch {
      // Sem provider de e-mail, tratamos como procedimento manual (S1).
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-4">
        <div className="card flex w-full max-w-md flex-col items-center gap-3 p-8 text-center">
          <span aria-hidden="true" className="material-symbols-outlined text-[40px] text-teal">
            mark_email_read
          </span>
          <h1 className="font-display text-xl font-bold text-navy">Solicitação registrada</h1>
          <p className="text-sm text-muted">
            Se o endereço <strong>{email}</strong> estiver cadastrado, você receberá em alguns
            minutos um e-mail com os próximos passos. Não chegou? Confira a caixa de spam ou peça a
            redefinição à PRPq (
            <span className="font-mono text-xs">pibic.suporte@prpq.universidade.br</span>).
          </p>
          <Link className="btn-primary mt-2 w-full" to="/login">
            Voltar para a entrada
          </Link>
          <button
            type="button"
            className="text-xs text-teal hover:underline"
            onClick={() => setSent(false)}
          >
            Digitei o e-mail errado — tentar outro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-4">
      <div className="card flex w-full max-w-md flex-col gap-4 p-8">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-xl font-bold text-navy">Recuperar Senha</h1>
          <p className="text-xs text-muted">
            Informe seu e-mail institucional para receber as instruções de redefinição.
          </p>
        </div>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1">
            <label className="label" htmlFor="recovery-email">
              E-mail institucional
            </label>
            <input
              id="recovery-email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              className="field"
              placeholder="identificador@universidade.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "Enviando…" : "Enviar instruções"}
          </button>
        </form>
        <Link className="text-center text-xs text-teal hover:underline" to="/login">
          Cancelar e voltar para a entrada
        </Link>
      </div>
    </div>
  );
}
