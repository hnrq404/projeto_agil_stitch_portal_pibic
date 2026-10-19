import { ArrowRight, FolderKanban, FolderOpen, GraduationCap, Send, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

import { GESTORES } from '@/app/navigation';
import { useCurrentUser } from '@/features/auth/AuthProvider';
import { useMinhasAvaliacoes } from '@/features/avaliacoes/api';
import { useMinhasCandidaturas, useMinhasInscricoes, useProjetosDivulgados } from '@/features/inscricoes/api';
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
  const divulgados = useProjetosDivulgados();
  const candidaturas = useMinhasCandidaturas();
  const projetos = useProjetos();
  const pendentes = candidaturas.data?.filter((c) => c.status === 'PENDENTE').length ?? 0;
  const selecionadas = candidaturas.data?.filter((c) => c.status === 'SELECIONADA').length ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiTile label="Projetos com vaga" value={divulgados.data?.length ?? '-'} />
        <KpiTile
          label="Candidaturas em análise"
          value={candidaturas.isPending ? '-' : pendentes}
          detail={selecionadas > 0 ? `selecionado(a) em ${selecionadas}` : undefined}
        />
        <KpiTile label="Bolsas em andamento" value={projetos.data?.length ?? '-'} accent="secondary" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Atalho to="/oportunidades" icon={<Users className="h-5 w-5" />} titulo="Projetos com vaga" descricao="Escolha um projeto divulgado e candidate-se." />
        <Atalho to="/candidaturas" icon={<Send className="h-5 w-5" />} titulo="Minhas candidaturas" descricao="Veja a resposta dos professores." />
        <Atalho to="/projetos" icon={<FolderKanban className="h-5 w-5" />} titulo="Bolsa e relatórios" descricao="Relatório mensal até o dia 5 de cada mês." />
      </div>
    </div>
  );
}

/** O professor escreve projetos, escolhe alunos, acompanha bolsistas e avalia projetos de colegas. */
function InicioDocente() {
  const meus = useMinhasInscricoes();
  const avaliacoes = useMinhasAvaliacoes();
  const projetos = useProjetos();
  const divulgados = meus.data?.filter((i) => i.status === 'DIVULGADA').length ?? 0;
  const semAluno = meus.data?.filter((i) => i.status === 'DIVULGADA' && !i.discente).length ?? 0;
  const pareceres = avaliacoes.data?.filter((a) => a.status === 'PENDENTE').length ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiTile
          label="Projetos divulgados"
          value={meus.isPending ? '-' : divulgados}
          detail={semAluno > 0 ? `${semAluno} sem aluno selecionado` : undefined}
        />
        <KpiTile label="Pareceres pendentes" value={avaliacoes.isPending ? '-' : pareceres} detail="projetos de colegas" />
        <KpiTile label="Bolsistas orientados" value={projetos.data?.length ?? '-'} accent="secondary" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Atalho to="/inscricoes" icon={<FolderOpen className="h-5 w-5" />} titulo="Meus projetos" descricao="Divulgue, escolha o aluno e envie ao edital." />
        <Atalho to="/avaliacoes" icon={<GraduationCap className="h-5 w-5" />} titulo="Minhas avaliações" descricao="Avalie os projetos em que foi indicado(a)." />
        <Atalho to="/projetos" icon={<FolderKanban className="h-5 w-5" />} titulo="Bolsas e relatórios" descricao="Aprove os relatórios mensais dos bolsistas." />
      </div>
    </div>
  );
}
