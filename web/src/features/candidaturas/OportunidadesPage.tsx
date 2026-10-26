import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Microscope, Search } from 'lucide-react';

import { useAuth } from '@/features/auth/AuthProvider';
import { useCandidatar, useMinhasCandidaturas, useProjetosDivulgados } from '@/features/inscricoes/api';
import { MIN_MENSAGEM_CANDIDATURA } from '@/features/inscricoes/etapas';
import { errorMessage } from '@/shared/api/http';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { formatDate } from '@/shared/lib/format';
import { BOLSA_LABEL, CANDIDATURA_STATUS } from '@/shared/lib/labels';
import type { ProjetoDivulgado } from '@/shared/types/api';
import { Code, StatusBadge, Tag } from '@/shared/ui/Badge';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Dialog } from '@/shared/ui/Dialog';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/shared/ui/Feedback';
import { CharCounter, Field, Input, Textarea } from '@/shared/ui/Form';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useToast } from '@/shared/ui/Toast';

/**
 * Projetos que os professores divulgaram nos editais abertos. Página pública:
 * visitantes leem; o aluno logado se candidata aqui mesmo.
 */
export function OportunidadesPage() {
  useDocumentTitle('Projetos com vaga');
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const editalId = params.get('edital') ?? undefined;
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<ProjetoDivulgado | null>(null);
  const projetos = useProjetosDivulgados({ editalId, q: busca.trim() || undefined });
  const ehAluno = user?.role === 'DISCENTE';
  const candidaturas = useMinhasCandidaturas(ehAluno);
  const statusDe = (id: string) => candidaturas.data?.find((c) => c.inscricaoId === id)?.status;

  return (
    <>
      <PageHeader
        title="Projetos de pesquisa com vaga"
        description="Projetos divulgados pelos professores da UNICAP. Candidate-se; o professor escolhe o aluno e envia o projeto ao edital."
      />

      <div className="relative mb-6 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
        <Input
          type="search"
          className="pl-9"
          placeholder="Buscar por tema, professor ou subárea"
          aria-label="Buscar projetos"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>
      {editalId && (
        <p className="-mt-3 mb-6 text-sm text-ink-muted">
          Mostrando os projetos de um edital.{' '}
          <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setParams({}, { replace: true })}>
            Ver todos os editais
          </button>
        </p>
      )}

      {projetos.isPending ? (
        <LoadingState />
      ) : projetos.isError ? (
        <ErrorState error={projetos.error} onRetry={() => void projetos.refetch()} />
      ) : projetos.data.length === 0 ? (
        <EmptyState
          icon={<Microscope className="h-6 w-6" />}
          title={busca ? 'Nenhum projeto encontrado' : 'Nenhum projeto com vaga no momento'}
          description="Quando um professor divulgar um projeto, ele aparece aqui e os alunos recebem uma notificação."
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {projetos.data.map((p) => {
            const status = statusDe(p.id);
            return (
              <li key={p.id}>
                <Card className="flex h-full flex-col p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    {p.edital && <Code>{`Edital ${p.edital.numero}`}</Code>}
                    {p.edital && <Tag>{BOLSA_LABEL[p.edital.tipoBolsa]}</Tag>}
                    {status && <StatusBadge status={CANDIDATURA_STATUS[status]} />}
                  </div>
                  <h2 className="mt-3 font-semibold leading-snug">{p.titulo}</h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    {p.orientador ? `${p.orientador.nome}${p.orientador.departamento ? ` (${p.orientador.departamento})` : ''}` : ''}
                    {p.subareaNome ? ` · ${p.subareaNome}` : ''}
                  </p>
                  <p className="mt-3 line-clamp-3 text-sm text-ink">{p.resumo}</p>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4 text-sm">
                    {p.edital && <span className="text-ink-subtle">Candidaturas até {formatDate(p.edital.dataFimInscricoes)}</span>}
                    <Button size="sm" variant={status ? 'secondary' : 'primary'} onClick={() => setAberto(p)}>
                      {status ? 'Ver projeto' : 'Ver e candidatar-se'}
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {aberto && <DetalheProjeto projeto={aberto} jaCandidatado={Boolean(statusDe(aberto.id))} onClose={() => setAberto(null)} />}
    </>
  );
}

function DetalheProjeto({
  projeto,
  jaCandidatado,
  onClose,
}: {
  projeto: ProjetoDivulgado;
  jaCandidatado: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const location = useLocation();
  const toast = useToast();
  const candidatar = useCandidatar();
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const ehAluno = user?.role === 'DISCENTE';
  const valida = mensagem.trim().length >= MIN_MENSAGEM_CANDIDATURA;
  // O professor avalia o candidato pelo Lattes: sem ele, a API recusa a candidatura.
  const semCurriculo = ehAluno && !user?.curriculo;

  async function enviar() {
    setErro(null);
    try {
      await candidatar.mutateAsync({ projetoId: projeto.id, mensagem });
      toast.success('Candidatura enviada. O professor foi avisado.');
      onClose();
    } catch (e) {
      setErro(errorMessage(e));
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={projeto.titulo}
      description={projeto.orientador ? `Orientação de ${projeto.orientador.nome}${projeto.subareaNome ? `, ${projeto.subareaNome}` : ''}` : undefined}
      footer={
        ehAluno && !jaCandidatado ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button disabled={!valida || semCurriculo} loading={candidatar.isPending} onClick={() => void enviar()}>
              Enviar candidatura
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        )
      }
    >
      <div className="space-y-4 text-sm">
        <Secao titulo="Resumo">{projeto.resumo}</Secao>
        <Secao titulo="Objetivos">{projeto.objetivos}</Secao>
        <Secao titulo="Metodologia">{projeto.metodologia}</Secao>

        {erro && <Alert tone="danger">{erro}</Alert>}
        {semCurriculo && !jaCandidatado && (
          <Alert tone="warning" title="Anexe seu currículo Lattes antes de se candidatar">
            O professor avalia os candidatos pelo Lattes.{' '}
            <Link to="/perfil" className="font-semibold underline">
              Ir para Meu perfil
            </Link>
          </Alert>
        )}
        {!user ? (
          <Alert tone="info" title="Entre como aluno para se candidatar">
            <Link to="/login" state={{ from: location.pathname }} className="font-semibold underline">
              Entrar
            </Link>{' '}
            ou{' '}
            <Link to="/cadastro" className="font-semibold underline">
              criar uma conta de discente
            </Link>
            .
          </Alert>
        ) : !ehAluno ? (
          <Alert tone="info">Somente alunos (discentes) se candidatam aos projetos.</Alert>
        ) : jaCandidatado ? (
          <Alert tone="success" title="Você já se candidatou a este projeto">
            Acompanhe a resposta do professor em{' '}
            <ButtonLink to="/candidaturas" variant="ghost" size="sm">
              Minhas candidaturas
            </ButtonLink>
          </Alert>
        ) : (
          <Field
            label="Apresente-se ao professor"
            hint={<CharCounter value={mensagem} min={MIN_MENSAGEM_CANDIDATURA} max={2000} />}
            required
          >
            <Textarea
              rows={4}
              maxLength={2000}
              placeholder="Por que você quer participar, disciplinas e experiências relacionadas, horas disponíveis por semana."
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
            />
          </Field>
        )}
      </div>
    </Dialog>
  );
}

function Secao({ titulo, children }: { titulo: string; children: string }) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-subtle">{titulo}</h3>
      <p className="whitespace-pre-line text-ink">{children}</p>
    </section>
  );
}
