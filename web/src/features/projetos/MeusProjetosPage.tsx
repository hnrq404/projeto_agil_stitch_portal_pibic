import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FolderKanban } from 'lucide-react';

import { useAuth } from '@/features/auth/AuthProvider';
import { GESTORES } from '@/app/navigation';
import { errorMessage } from '@/shared/api/http';
import { formatDate } from '@/shared/lib/format';
import { BOLSA_LABEL } from '@/shared/lib/labels';
import { Code, Tag } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/Feedback';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useToast } from '@/shared/ui/Toast';

import { exportarProjetosCsv, useProjetos } from './api';

export function MeusProjetosPage() {
  const { hasRole } = useAuth();
  const gestor = hasRole(...GESTORES);
  const { data: projetos, isPending, isError, error, refetch } = useProjetos();
  const toast = useToast();
  const [exportando, setExportando] = useState(false);

  async function exportar() {
    setExportando(true);
    try {
      await exportarProjetosCsv();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExportando(false);
    }
  }

  return (
    <>
      <PageHeader
        title={gestor ? 'Projetos aprovados' : 'Meus projetos'}
        description={
          gestor
            ? 'Todos os projetos com bolsa homologada e a situação dos relatórios.'
            : 'Projetos aprovados com bolsa: envie e acompanhe os relatórios parciais e finais.'
        }
        actions={
          gestor && (
            <Button
              variant="secondary"
              icon={<Download className="h-4 w-4" aria-hidden />}
              loading={exportando}
              onClick={() => void exportar()}
            >
              Exportar CSV
            </Button>
          )
        }
      />
      {isPending ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : projetos.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-6 w-6" />}
          title="Nenhum projeto aprovado ainda"
          description="Depois que uma proposta é aprovada pela gestão, ela vira um projeto e aparece aqui."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projetos.map((p) => (
            <Card key={p.id} className="flex flex-col p-5">
              <div className="flex flex-wrap gap-2">
                <Code>{p.protocolo ?? '-'}</Code>
                {p.edital && <Tag>{BOLSA_LABEL[p.edital.tipoBolsa]}</Tag>}
              </div>
              <h2 className="mt-3 font-semibold leading-snug">
                <Link to={`/projetos/${p.id}`} className="hover:underline">
                  {p.titulo}
                </Link>
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                Bolsista {p.discente?.nome}, orientação de {p.orientador?.nome}
              </p>
              <p className="mt-4 border-t border-line pt-3 text-sm text-ink-subtle">
                Aprovado em {formatDate(p.homologadaEm)}, edital {p.edital?.numero}
              </p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
