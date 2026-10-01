import { useDeferredValue, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Microscope, Search } from 'lucide-react';

import { http } from '@/shared/api/http';
import { BOLSA_LABEL } from '@/shared/lib/labels';
import type { ListResponse, PesquisaPublica } from '@/shared/types/api';
import { Code, Tag } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/Feedback';
import { Field, Input, Select } from '@/shared/ui/Form';
import { PageHeader } from '@/shared/ui/PageHeader';

function usePesquisas() {
  return useQuery({
    queryKey: ['publico', 'pesquisas'],
    queryFn: ({ signal }) => http.get<ListResponse<PesquisaPublica>>('/api/publico/pesquisas', signal),
    select: (res) => res.data,
    staleTime: 5 * 60_000,
  });
}

/**
 * Vitrine pública (RF25/RN10): só pesquisas aprovadas, sem login. A lista é
 * pequena, então os filtros rodam no cliente e ficam na URL (links compartilháveis).
 */
export function VitrinePesquisasPage() {
  const { data, isPending, isError, error, refetch } = usePesquisas();
  const [params, setParams] = useSearchParams();
  const busca = params.get('q') ?? '';
  const subarea = params.get('subarea') ?? '';
  const ano = params.get('ano') ?? '';
  const buscaAdiada = useDeferredValue(busca);

  function setFiltro(chave: string, valor: string) {
    const novo = new URLSearchParams(params);
    if (valor) novo.set(chave, valor);
    else novo.delete(chave);
    setParams(novo, { replace: true });
  }

  const subareas = useMemo(
    () => [...new Map((data ?? []).map((p) => [p.subareaCode, p.subareaNome])).entries()].sort(),
    [data],
  );
  const anos = useMemo(
    () => [...new Set((data ?? []).map((p) => p.ano).filter((a): a is number => a !== null))].sort((a, b) => b - a),
    [data],
  );

  const termo = buscaAdiada.trim().toLowerCase();
  const filtradas = (data ?? []).filter(
    (p) =>
      (!subarea || p.subareaCode === subarea) &&
      (!ano || String(p.ano) === ano) &&
      (!termo ||
        [p.titulo, p.resumo, p.palavrasChave, p.orientador?.nome ?? '', p.bolsista ?? ''].join(' ').toLowerCase().includes(termo)),
  );

  return (
    <>
      <PageHeader
        eyebrow="Vitrine pública"
        title="Pesquisas de iniciação científica"
        description="Projetos aprovados nos editais PIBIC e PIBITI, com bolsistas e orientadores da instituição."
      />

      <Card className="mb-6 grid gap-4 p-4 md:grid-cols-[1fr_220px_160px]">
        <Field label="Buscar">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
            <Input
              type="search"
              className="pl-9"
              placeholder="Título, palavra-chave, orientador..."
              value={busca}
              onChange={(e) => setFiltro('q', e.target.value)}
            />
          </div>
        </Field>
        <Field label="Subárea">
          <Select value={subarea} onChange={(e) => setFiltro('subarea', e.target.value)}>
            <option value="">Todas</option>
            {subareas.map(([code, nome]) => (
              <option key={code} value={code}>
                {nome}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ano">
          <Select value={ano} onChange={(e) => setFiltro('ano', e.target.value)}>
            <option value="">Todos</option>
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      {isPending ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : filtradas.length === 0 ? (
        <EmptyState
          icon={<Microscope className="h-6 w-6" />}
          title={data.length === 0 ? 'Nenhuma pesquisa publicada ainda' : 'Nenhuma pesquisa com estes filtros'}
          description={data.length === 0 ? 'Os projetos aparecem aqui depois de aprovados.' : 'Tente outros termos ou limpe os filtros.'}
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-muted" aria-live="polite">
            {filtradas.length} pesquisa(s) encontrada(s)
          </p>
          <div className="grid gap-5 md:grid-cols-2">
            {filtradas.map((p) => (
              <Card key={p.id} className="flex flex-col p-5">
                <article className="flex flex-1 flex-col">
                  <div className="flex flex-wrap items-center gap-2">
                    {p.protocolo && <Code>{p.protocolo}</Code>}
                    {p.edital && <Tag>{BOLSA_LABEL[p.edital.tipoBolsa]}</Tag>}
                    {p.ano && <span className="text-xs text-ink-subtle">{p.ano}</span>}
                  </div>
                  <h2 className="mt-3 text-base font-semibold leading-snug">{p.titulo}</h2>
                  <p className="mb-4 mt-2 line-clamp-4 text-sm leading-relaxed text-ink-muted">{p.resumo}</p>
                  <div className="mt-auto space-y-1 border-t border-line pt-3 text-sm">
                    <p>
                      <span className="text-ink-subtle">Orientação:</span> {p.orientador?.nome}
                      {p.orientador?.departamento && <span className="text-ink-subtle"> ({p.orientador.departamento})</span>}
                    </p>
                    <p>
                      <span className="text-ink-subtle">Bolsista:</span> {p.bolsista}
                    </p>
                    <div className="pt-1">
                      <Tag>{p.subareaNome}</Tag>
                    </div>
                  </div>
                </article>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}
