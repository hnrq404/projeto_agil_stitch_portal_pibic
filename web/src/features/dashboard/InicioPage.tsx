import { ArrowRight, FolderKanban, FolderOpen, GraduationCap, Megaphone, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

import { GESTORES } from '@/app/navigation';
import { useCurrentUser } from '@/features/auth/AuthProvider';
import { useMinhasAvaliacoes } from '@/features/avaliacoes/api';
import { useEditaisPublicos } from '@/features/editais/api';
import { useMinhasInscricoes, useOrientacoes } from '@/features/inscricoes/api';
import { useProjetos } from '@/features/projetos/api';
import { KpiTile } from '@/shared/ui/DataDisplay';
import { PageHeader } from '@/shared/ui/PageHeader';

import { PainelGestor } from './PainelGestor';

/** S6.4: a mesma rota /inicio mostra widgets diferentes conforme o papel. */
export function InicioPage() {
  const user = useCurrentUser();
  if (GESTORES.includes(user.role)) return <PainelGestor />;

  const primeiroNome = user.nome.replace(/^(prof\.?|profa\.?|dr\.?|dra\.?)\s+/i, '').split(' ')[0];
  return (
    <>
      <PageHeader title={`Olá, ${primeiroNome}`} description="Veja o que precisa da sua atenção hoje." />
      {user.role === 'DISCENTE' && <InicioDiscente />}
      {user.role === 'DOCENTE' && <InicioDocente />}
      {user.role === 'AVALIADOR' && <InicioAvaliador />}
    </>
  );
}

function Atalho({ to, icon, titulo, descricao }: { to: string; icon: ReactNode; titulo: string; descricao: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-xl border border-line bg-surface p-5 shadow-card transition hover:border-line-strong hover:shadow-raised"
    >
      <span className="rounded-lg bg-primary-soft p-3 text-primary" aria-hidden>
        {icon}
      </span>
      <span className="flex-1">
        <span className="block font-semibold text-ink">{titulo}</span>
        <span className="block text-sm text-ink-muted">{descricao}</span>
      </span>
      <ArrowRight className="h-5 w-5 text-ink-subtle transition group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

function InicioDiscente() {
  const inscricoes = useMinhasInscricoes();
  const editais = useEditaisPublicos();
  const projetos = useProjetos();
  const rascunhos = inscricoes.data?.filter((i) => i.status === 'RASCUNHO').length ?? 0;
  const emAndamento = inscricoes.data?.filter((i) => !['RASCUNHO', 'APROVADA', 'RECUSADA'].includes(i.status)).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiTile label="Editais abertos" value={editais.data?.length ?? '-'} />
        <KpiTile label="Inscrições em andamento" value={inscricoes.isPending ? '-' : emAndamento} detail={`${rascunhos} rascunho(s)`} />
        <KpiTile label="Projetos com bolsa" value={projetos.data?.length ?? '-'} accent="secondary" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Atalho to="/editais" icon={<Megaphone className="h-5 w-5" />} titulo="Editais abertos" descricao="Escolha um edital e inscreva sua proposta." />
        <Atalho to="/inscricoes" icon={<FolderOpen className="h-5 w-5" />} titulo="Minhas inscrições" descricao="Continue rascunhos e acompanhe a situação." />
        <Atalho to="/projetos" icon={<FolderKanban className="h-5 w-5" />} titulo="Meus projetos" descricao="Envie relatórios parciais e finais." />
      </div>
    </div>
  );
}

function InicioDocente() {
  const orientacoes = useOrientacoes();
  const projetos = useProjetos();
  const pendentes = orientacoes.data?.filter((i) => i.status === 'SUBMETIDA' && i.vinculoStatus === 'PENDENTE').length ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <KpiTile label="Pedidos de orientação" value={orientacoes.isPending ? '-' : pendentes} detail="aguardando sua resposta" />
        <KpiTile label="Projetos orientados" value={projetos.data?.length ?? '-'} accent="secondary" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Atalho to="/orientacoes" icon={<Users className="h-5 w-5" />} titulo="Orientações" descricao="Confirme ou recuse os pedidos dos discentes." />
        <Atalho to="/projetos" icon={<FolderKanban className="h-5 w-5" />} titulo="Projetos" descricao="Avalie os relatórios dos seus bolsistas." />
      </div>
    </div>
  );
}

function InicioAvaliador() {
  const avaliacoes = useMinhasAvaliacoes();
  const pendentes = avaliacoes.data?.filter((a) => a.status === 'PENDENTE').length ?? 0;
  const concluidas = avaliacoes.data?.filter((a) => a.status === 'CONCLUIDA').length ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <KpiTile label="Pareceres pendentes" value={avaliacoes.isPending ? '-' : pendentes} />
        <KpiTile label="Pareceres enviados" value={avaliacoes.isPending ? '-' : concluidas} accent="secondary" />
      </div>
      <Atalho to="/avaliacoes" icon={<GraduationCap className="h-5 w-5" />} titulo="Minhas avaliações" descricao="Abra a proposta e avalie com a rubrica de 0 a 10." />
    </div>
  );
}
