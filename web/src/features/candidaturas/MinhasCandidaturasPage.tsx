import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Send } from 'lucide-react';

import { useDesistirCandidatura, useMinhasCandidaturas } from '@/features/inscricoes/api';
import { errorMessage } from '@/shared/api/http';
import { formatDate } from '@/shared/lib/format';
import { CANDIDATURA_STATUS, INSCRICAO_STATUS } from '@/shared/lib/labels';
import type { Candidatura } from '@/shared/types/api';
import { Code, StatusBadge } from '@/shared/ui/Badge';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ConfirmDialog } from '@/shared/ui/Dialog';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/Feedback';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useToast } from '@/shared/ui/Toast';

/** O que acontece depois, do ponto de vista do aluno. */
function andamento(c: Candidatura): string {
  if (c.status === 'NAO_SELECIONADA') return 'O professor escolheu outro aluno.';
  if (c.status === 'PENDENTE') return 'Aguardando a escolha do professor.';
  switch (c.projeto?.status) {
    case 'DIVULGADA':
      return 'Você foi selecionado(a). O professor ainda vai enviar o projeto ao edital.';
    case 'EM_AVALIACAO':
    case 'AVALIADA':
      return 'Projeto enviado ao edital e em avaliação.';
    case 'APROVADA':
      return 'Projeto aprovado: você é bolsista. Envie o relatório mensal até o dia 5.';
    case 'RECUSADA':
      return 'O projeto não foi aprovado no edital.';
    default:
      return '';
  }
}

/** Aluno: candidaturas aos projetos divulgados e o andamento de cada uma. */
export function MinhasCandidaturasPage() {
  const { data, isPending, isError, error, refetch } = useMinhasCandidaturas();
  const desistir = useDesistirCandidatura();
  const toast = useToast();
  const [desistindo, setDesistindo] = useState<Candidatura | null>(null);

  async function confirmarDesistencia() {
    if (!desistindo) return;
    try {
      await desistir.mutateAsync(desistindo.id);
      toast.success('Candidatura retirada.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDesistindo(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Minhas candidaturas"
        description="Acompanhe os projetos a que você se candidatou e a resposta de cada professor."
        actions={<ButtonLink to="/oportunidades">Ver projetos com vaga</ButtonLink>}
      />
      {isPending ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          icon={<Send className="h-6 w-6" />}
          title="Você ainda não se candidatou"
          description="Escolha um projeto divulgado por um professor e conte por que quer participar."
          action={<ButtonLink to="/oportunidades">Ver projetos com vaga</ButtonLink>}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {data.map((c) => {
            const selecionado = c.status === 'SELECIONADA';
            return (
              <li key={c.id}>
                <Card className="flex h-full flex-col p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    {c.projeto?.edital && <Code>{`Edital ${c.projeto.edital.numero}`}</Code>}
                    <StatusBadge status={CANDIDATURA_STATUS[c.status]} />
                  </div>
                  <h2 className="mt-3 font-semibold leading-snug">
                    {selecionado ? (
                      <Link to={`/inscricoes/${c.inscricaoId}`} className="hover:underline">
                        {c.projeto?.titulo}
                      </Link>
                    ) : (
                      c.projeto?.titulo
                    )}
                  </h2>
                  {c.projeto?.orientador && <p className="mt-1 text-sm text-ink-muted">{c.projeto.orientador.nome}</p>}
                  <p className="mt-3 text-sm text-ink">{andamento(c)}</p>
                  {selecionado && c.projeto && (
                    <div className="mt-2">
                      <StatusBadge status={INSCRICAO_STATUS[c.projeto.status]} />
                    </div>
                  )}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
                    <span className="text-ink-subtle">Candidatura em {formatDate(c.criadoEm)}</span>
                    {c.status === 'PENDENTE' && (
                      <Button size="sm" variant="ghost" onClick={() => setDesistindo(c)}>
                        Desistir
                      </Button>
                    )}
                    {selecionado && c.projeto?.status === 'APROVADA' && (
                      <ButtonLink to={`/projetos/${c.inscricaoId}`} size="sm">
                        Relatórios
                      </ButtonLink>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={desistindo !== null}
        title="Desistir da candidatura?"
        description={`Sua candidatura ao projeto "${desistindo?.projeto?.titulo ?? ''}" será retirada. Você pode se candidatar de novo enquanto o projeto estiver divulgado.`}
        confirmLabel="Desistir"
        tone="danger"
        loading={desistir.isPending}
        onConfirm={() => void confirmarDesistencia()}
        onCancel={() => setDesistindo(null)}
      />
    </>
  );
}
