import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useAuth, useCurrentUser } from '@/features/auth/AuthProvider';
import { senhaForte } from '@/features/auth/RedefinirSenhaPage';
import { errorMessage, http, uploadPdf } from '@/shared/api/http';
import { formatDate } from '@/shared/lib/format';
import { ROLE_LABEL } from '@/shared/lib/labels';
import type { AuthResponse, Usuario } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Card, CardHeader, DataItem } from '@/shared/ui/Card';
import { Alert } from '@/shared/ui/Feedback';
import { FileDropzone } from '@/shared/ui/FileDropzone';
import { Field, Input } from '@/shared/ui/Form';
import { PageHeader } from '@/shared/ui/PageHeader';
import { abrirPdf } from '@/shared/ui/PdfViewer';
import { useToast } from '@/shared/ui/Toast';

/** Dados da conta, currículo Lattes (aluno) e troca de senha. */
export function PerfilPage() {
  const usuario = useCurrentUser();

  return (
    <div className="space-y-6">
      <PageHeader title="Meu perfil" description="Seus dados no Portal PIBIC." />
      <Card>
        <CardHeader title="Dados da conta" />
        <dl className="grid gap-4 p-5 sm:grid-cols-2">
          <DataItem label="Nome">{usuario.nome}</DataItem>
          <DataItem label="E-mail">{usuario.email}</DataItem>
          <DataItem label="Perfil">{ROLE_LABEL[usuario.role]}</DataItem>
          {usuario.departamento && <DataItem label="Departamento">{usuario.departamento}</DataItem>}
          {usuario.matricula && <DataItem label="Matrícula">{usuario.matricula}</DataItem>}
        </dl>
      </Card>
      {usuario.role === 'DISCENTE' && <CurriculoCard usuario={usuario} />}
      <TrocarSenhaCard />
    </div>
  );
}

function CurriculoCard({ usuario }: { usuario: Usuario }) {
  const { atualizarUsuario } = useAuth();
  const toast = useToast();
  const atual = usuario.curriculo;

  async function enviar(file: File, onProgress: (pct: number) => void) {
    atualizarUsuario(await uploadPdf<Usuario>('/api/perfil/curriculo', file, onProgress));
    toast.success('Currículo atualizado. Os projetos já enviados continuam com a versão da época do envio.');
  }

  return (
    <Card>
      <CardHeader
        title="Currículo Lattes"
        description="Os professores veem este arquivo quando você se candidata. No envio ao edital, o projeto guarda uma cópia."
      />
      <div className="space-y-3 p-5">
        {!atual && (
          <Alert tone="warning" title="Anexe seu currículo para se candidatar">
            Exporte o currículo da Plataforma Lattes em PDF e envie aqui.
          </Alert>
        )}
        <FileDropzone
          label="Currículo Lattes (PDF)"
          description={atual ? `Enviado em ${formatDate(atual.enviadoEm)}. Envie outro para substituir.` : undefined}
          required
          current={atual}
          onUpload={enviar}
          onOpen={
            atual ? () => void abrirPdf('/api/perfil/curriculo').catch((e) => toast.error(errorMessage(e))) : undefined
          }
        />
      </div>
    </Card>
  );
}

const senhaSchema = z
  .object({ senhaAtual: z.string().min(1, 'Informe a senha atual.'), novaSenha: senhaForte, confirmacao: z.string() })
  .refine((v) => v.novaSenha === v.confirmacao, { message: 'As senhas não conferem.', path: ['confirmacao'] });

type SenhaValues = z.infer<typeof senhaSchema>;

function TrocarSenhaCard() {
  const { iniciarSessao } = useAuth();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SenhaValues>({ resolver: zodResolver(senhaSchema) });

  async function onSubmit({ senhaAtual, novaSenha }: SenhaValues) {
    try {
      // A troca encerra as outras sessões; esta continua com o token novo.
      iniciarSessao(await http.post<AuthResponse>('/api/auth/senha', { senhaAtual, novaSenha }));
      reset();
      toast.success('Senha alterada. As sessões em outros aparelhos foram encerradas.');
    } catch (e) {
      setError('senhaAtual', { message: errorMessage(e) });
    }
  }

  return (
    <Card>
      <CardHeader title="Trocar senha" />
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 p-5 sm:grid-cols-3" noValidate>
        <Field label="Senha atual" error={errors.senhaAtual?.message} required>
          <Input type="password" autoComplete="current-password" {...register('senhaAtual')} />
        </Field>
        <Field label="Nova senha" hint="8+ caracteres, letras e números" error={errors.novaSenha?.message} required>
          <Input type="password" autoComplete="new-password" {...register('novaSenha')} />
        </Field>
        <Field label="Confirmar nova senha" error={errors.confirmacao?.message} required>
          <Input type="password" autoComplete="new-password" {...register('confirmacao')} />
        </Field>
        <div className="sm:col-span-3">
          <Button type="submit" loading={isSubmitting}>
            Salvar nova senha
          </Button>
        </div>
      </form>
    </Card>
  );
}
