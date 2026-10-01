import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';

import { useCurrentUser } from '@/features/auth/AuthProvider';
import { errorMessage, http } from '@/shared/api/http';
import { formatDate } from '@/shared/lib/format';
import { ROLE_LABEL } from '@/shared/lib/labels';
import type { ListResponse, UserRole, Usuario } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ErrorState, LoadingState } from '@/shared/ui/Feedback';
import { FilterPills } from '@/shared/ui/FilterPills';
import { Input, Select } from '@/shared/ui/Form';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useToast } from '@/shared/ui/Toast';

const ROLES = Object.keys(ROLE_LABEL) as UserRole[];
const usuariosKey = ['usuarios'] as const;

function useUsuarios() {
  return useQuery({
    queryKey: usuariosKey,
    queryFn: ({ signal }) => http.get<ListResponse<Usuario>>('/api/usuarios', signal),
    select: (res) => res.data,
  });
}

function useAtualizarUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; role: UserRole; departamento: string }) =>
      http.patch<Usuario>(`/api/usuarios/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usuariosKey }),
  });
}

/** S1.2: o gestor atribui papéis e departamentos. A mudança vale na próxima ação do usuário (RN11). */
export function GestaoUsuariosPage() {
  const { data, isPending, isError, error, refetch } = useUsuarios();
  const [filtro, setFiltro] = useState<UserRole | 'TODOS'>('TODOS');
  const [busca, setBusca] = useState('');
  const termo = busca.trim().toLowerCase();

  const lista = (data ?? []).filter(
    (u) =>
      (filtro === 'TODOS' || u.role === filtro) &&
      (!termo || `${u.nome} ${u.email}`.toLowerCase().includes(termo)),
  );

  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        title="Usuários e papéis"
        description="Promova docentes a avaliadores, ajuste departamentos (usados no conflito de interesse) e defina gestores."
      />
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <Input
            type="search"
            aria-label="Buscar por nome ou e-mail"
            placeholder="Buscar por nome ou e-mail"
            className="pl-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <FilterPills<UserRole | 'TODOS'>
          label="Filtrar por papel"
          value={filtro}
          onChange={setFiltro}
          options={[
            { value: 'TODOS', label: 'Todos', count: data?.length },
            ...ROLES.filter((r) => r !== 'ADMIN').map((r) => ({
              value: r,
              label: ROLE_LABEL[r],
              count: data?.filter((u) => u.role === r).length,
            })),
          ]}
        />
      </div>

      {isPending ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-canvas text-left text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                <tr>
                  <th scope="col" className="px-5 py-3">Pessoa</th>
                  <th scope="col" className="px-5 py-3">Papel</th>
                  <th scope="col" className="px-5 py-3">Departamento</th>
                  <th scope="col" className="px-5 py-3">Cadastro</th>
                  <th scope="col" className="px-5 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {lista.map((u) => (
                  <LinhaUsuario key={`${u.id}-${u.role}-${u.departamento}`} usuario={u} />
                ))}
              </tbody>
            </table>
          </div>
          {lista.length === 0 && <p className="p-5 text-sm text-ink-muted">Nenhum usuário encontrado.</p>}
        </Card>
      )}
    </>
  );
}

function LinhaUsuario({ usuario }: { usuario: Usuario }) {
  const eu = useCurrentUser();
  const atualizar = useAtualizarUsuario();
  const toast = useToast();
  const [role, setRole] = useState<UserRole>(usuario.role);
  const [departamento, setDepartamento] = useState(usuario.departamento);
  const alterado = role !== usuario.role || departamento.trim().toUpperCase() !== usuario.departamento;
  const souEu = eu.id === usuario.id;

  async function salvar() {
    try {
      await atualizar.mutateAsync({ id: usuario.id, role, departamento });
      toast.success(`${usuario.nome} atualizado(a).`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <tr className="align-middle">
      <td className="px-5 py-3">
        <span className="block font-medium text-ink">
          {usuario.nome}
          {souEu && <span className="ml-1 text-xs text-ink-subtle">(você)</span>}
        </span>
        <span className="block text-xs text-ink-subtle">{usuario.email}</span>
      </td>
      <td className="px-5 py-3">
        <Select
          aria-label={`Papel de ${usuario.nome}`}
          value={role}
          disabled={souEu}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className="w-44"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </Select>
      </td>
      <td className="px-5 py-3">
        <Input
          aria-label={`Departamento de ${usuario.nome}`}
          value={departamento}
          onChange={(e) => setDepartamento(e.target.value)}
          className="w-32 uppercase"
        />
      </td>
      <td className="px-5 py-3 text-ink-muted tnum">{formatDate(usuario.criadoEm)}</td>
      <td className="px-5 py-3 text-right">
        <Button size="sm" disabled={!alterado} loading={atualizar.isPending} onClick={() => void salvar()}>
          Salvar
        </Button>
      </td>
    </tr>
  );
}
