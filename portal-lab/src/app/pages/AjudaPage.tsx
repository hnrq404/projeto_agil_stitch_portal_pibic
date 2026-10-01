import { useMemo, useState } from "react";
import { can, ROLES, ROLE_LABELS } from "../../../convex/roles";
import { PASSWORD_RULES } from "../../../convex/passwordRules";
import { NAV_ITEMS } from "../layout/nav";
import { SHORTCUTS } from "../layout/useKeyboardShortcuts";
import { PublicOrShell } from "../PublicOrShell";

type Topic = { id: string; question: string; steps: string[] };

/** Tarefas mais comuns, em passos concretos (Nielsen #10). */
const TOPICS: Topic[] = [
  {
    id: "primeiro-acesso",
    question: "Como faço meu primeiro acesso?",
    steps: [
      "Na tela inicial, abra a aba “Criar conta”.",
      "Preencha nome, matrícula (ou SIAPE), e-mail institucional e uma senha.",
      "Escolha o perfil: Aluno é liberado na hora; Docente e Avaliador passam por aprovação da PRPq.",
      "Marque a declaração de veracidade e clique em “Criar minha conta”.",
    ],
  },
  {
    id: "senha",
    question: "Quais são as regras da senha?",
    steps: PASSWORD_RULES.map((r) => r.label + "."),
  },
  {
    id: "esqueci-senha",
    question: "Esqueci minha senha. E agora?",
    steps: [
      "Na tela de entrada, clique em “Esqueceu sua senha?”.",
      "Informe o e-mail institucional usado no cadastro.",
      "Siga as instruções que chegarem por e-mail. Se não chegar em alguns minutos, confira a caixa de spam ou escreva para o suporte.",
    ],
  },
  {
    id: "perfil-pendente",
    question: "Pedi acesso como Docente/Avaliador. Quando é liberado?",
    steps: [
      "Enquanto o pedido não é aprovado, você usa o portal como Aluno.",
      "Um aviso no topo da tela mostra que o pedido está aguardando aprovação.",
      "Quando a PRPq aprovar, o menu lateral passa a mostrar as novas áreas automaticamente.",
    ],
  },
  {
    id: "aprovar-perfil",
    question: "(Gestor PRPq) Como aprovo um pedido de acesso?",
    steps: [
      "Abra “Gestão de Usuários” no menu lateral.",
      "Na seção “Pedidos aguardando aprovação”, confira os dados da pessoa.",
      "Clique em “Aprovar” e confirme. Se aprovou por engano, use “Desfazer” na mensagem de confirmação.",
    ],
  },
  {
    id: "mudar-perfil",
    question: "(Gestor PRPq) Como altero o perfil de alguém?",
    steps: [
      "Em “Gestão de Usuários”, use a busca para encontrar a pessoa pelo nome, e-mail ou matrícula.",
      "Escolha o novo perfil na coluna “Alterar perfil”.",
      "Confirme a mudança no diálogo. A alteração vale imediatamente e pode ser desfeita logo em seguida.",
    ],
  },
  {
    id: "criar-edital",
    question: "(Gestor PRPq) Como crio e publico um edital?",
    steps: [
      "Abra “Editais” no menu lateral e clique em “Novo edital”.",
      "Preencha título, programa, datas e as bolsas de cada grande área CNPq. O sistema avisa na hora se algo estiver inconsistente.",
      "Salve: o edital fica como rascunho, visível só para a gestão.",
      "Na página do edital, clique em “Publicar edital” e confirme. Toda a comunidade recebe uma notificação.",
    ],
  },
  {
    id: "editar-edital",
    question: "(Gestor PRPq) Posso alterar um edital já publicado?",
    steps: [
      "Em rascunho, todos os dados podem ser alterados.",
      "Com as inscrições abertas, só é possível prorrogar a data de encerramento.",
      "Em análise ou finalizado, o edital não pode mais ser alterado.",
      "Toda alteração fica registrada no histórico, na página do edital.",
    ],
  },
  {
    id: "situacao-edital",
    question: "O que significa cada situação do edital?",
    steps: [
      "Rascunho: em preparação pela PRPq, ainda não visível para a comunidade.",
      "Inscrições abertas: é possível se inscrever até a data de encerramento.",
      "Em análise: as inscrições fecharam (manualmente ou no fim do prazo) e as propostas estão sendo avaliadas.",
      "Finalizado: resultado concluído. Um edital finalizado não pode ser reaberto.",
    ],
  },
  {
    id: "acesso-negado",
    question: "Apareceu “Esta área não está disponível para o seu perfil”.",
    steps: [
      "Cada perfil enxerga apenas as áreas que usa — veja a tabela “O que cada perfil acessa” abaixo.",
      "Use “Voltar” ou “Ir para minha página inicial” para sair da tela.",
      "Se você deveria ter acesso, escreva para o suporte informando seu e-mail e o perfil necessário.",
    ],
  },
];

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function HelpContent() {
  const [query, setQuery] = useState("");
  const topics = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return TOPICS;
    return TOPICS.filter((t) => normalize([t.question, ...t.steps].join(" ")).includes(q));
  }, [query]);

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-bold text-navy">Central de Ajuda</h1>
        <div className="relative max-w-xl">
          <span
            aria-hidden="true"
            className="material-symbols-outlined absolute left-3 top-2.5 text-[20px] text-hairline-strong"
          >
            search
          </span>
          <label htmlFor="help-search" className="sr-only">
            Buscar na ajuda
          </label>
          <input
            id="help-search"
            type="search"
            className="field pl-10"
            placeholder="Busque por senha, cadastro, aprovar, perfil…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </header>

      <div className="flex flex-col gap-3" aria-live="polite">
        {topics.length === 0 ? (
          <p className="text-sm text-muted">
            Nenhum tópico encontrado para “{query}”. Tente outra palavra ou fale com o suporte.
          </p>
        ) : (
          topics.map((t) => (
            <details key={t.id} className="card group p-4" open={query.trim().length > 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold text-navy">
                {t.question}
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined text-[20px] text-muted transition-transform group-open:rotate-180"
                >
                  expand_more
                </span>
              </summary>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted">
                {t.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </details>
          ))
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold text-navy">O que cada perfil acessa</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-navy text-white">
                <th className="px-4 py-3 font-semibold">Área</th>
                {ROLES.map((r) => (
                  <th key={r} className="px-4 py-3 text-center font-semibold">
                    {ROLE_LABELS[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {NAV_ITEMS.map((item) => (
                <tr key={item.to}>
                  <td className="px-4 py-2 font-semibold text-navy">{item.label}</td>
                  {ROLES.map((r) =>
                    can(r, item.perm) ? (
                      <td key={r} className="px-4 py-2 text-center font-semibold text-teal">
                        Sim
                      </td>
                    ) : (
                      <td key={r} className="px-4 py-2 text-center text-muted">
                        Não
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold text-navy">Atalhos de teclado</h2>
        <ul className="card divide-y divide-hairline text-sm">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex items-center justify-between gap-4 px-4 py-2">
              <span className="text-muted">{s.action}</span>
              <kbd className="rounded border border-hairline-strong bg-canvas px-2 py-0.5 font-mono text-xs text-ink">
                {s.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-hairline bg-hairline p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
          <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-teal">
            support_agent
          </span>
          Não encontrou o que precisava?
        </h2>
        <p className="text-xs text-muted">
          Escreva para a Secretaria de Iniciação Científica informando seu nome, matrícula/SIAPE e o
          que tentou fazer.
        </p>
        <a
          className="font-mono text-xs font-bold text-navy underline"
          href="mailto:pibic.suporte@prpq.universidade.br"
        >
          pibic.suporte@prpq.universidade.br
        </a>
      </section>
    </section>
  );
}

/** `/ajuda` funciona logado (dentro da shell) e deslogado (a partir do login). */
export function AjudaPage() {
  return (
    <PublicOrShell loadingLabel="Carregando ajuda…">
      <HelpContent />
    </PublicOrShell>
  );
}
