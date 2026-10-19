import type {
  AnexoTipo,
  BolsaTipo,
  CandidaturaStatus,
  EditalStatus,
  InscricaoStatus,
  RelatorioStatus,
  SituacaoRelatorio,
  UserRole,
} from '@/shared/types/api';

/** Tons semânticos do DESIGN.md: verde = ativo/aprovado, âmbar = em análise, cinza = finalizado, vermelho = recusado. */
export type Tone = 'success' | 'warning' | 'neutral' | 'danger' | 'info';

export interface StatusInfo {
  label: string;
  tone: Tone;
}

export const ROLE_LABEL: Record<UserRole, string> = {
  DISCENTE: 'Discente',
  DOCENTE: 'Professor(a)',
  GESTOR: 'Gestor(a)',
  ADMIN: 'Administrador(a)',
  USUARIO: 'Visitante',
};

export const BOLSA_LABEL: Record<BolsaTipo, string> = {
  PIBIC: 'PIBIC',
  PIBITI: 'PIBITI',
  PIBIC_AF: 'PIBIC Ações Afirmativas',
  VOLUNTARIO: 'Voluntário (PIVIC)',
};

export const ANEXO_LABEL: Record<AnexoTipo, string> = {
  PLANO_TRABALHO: 'Plano de trabalho',
  LATTES: 'Currículo Lattes do aluno',
};

export const EDITAL_STATUS: Record<EditalStatus, StatusInfo> = {
  RASCUNHO: { label: 'Rascunho', tone: 'neutral' },
  PUBLICADO: { label: 'Inscrições abertas', tone: 'success' },
  ENCERRADO: { label: 'Encerrado', tone: 'neutral' },
};

export const INSCRICAO_STATUS: Record<InscricaoStatus, StatusInfo> = {
  RASCUNHO: { label: 'Rascunho', tone: 'neutral' },
  DIVULGADA: { label: 'Divulgado aos alunos', tone: 'info' },
  EM_AVALIACAO: { label: 'Em avaliação', tone: 'warning' },
  AVALIADA: { label: 'Avaliado', tone: 'warning' },
  APROVADA: { label: 'Aprovado', tone: 'success' },
  RECUSADA: { label: 'Não aprovado', tone: 'danger' },
};

export const CANDIDATURA_STATUS: Record<CandidaturaStatus, StatusInfo> = {
  PENDENTE: { label: 'Em análise pelo professor', tone: 'warning' },
  SELECIONADA: { label: 'Selecionado(a)', tone: 'success' },
  NAO_SELECIONADA: { label: 'Não selecionado(a)', tone: 'neutral' },
};

export const RELATORIO_STATUS: Record<RelatorioStatus, StatusInfo> = {
  ENVIADO: { label: 'Em análise', tone: 'warning' },
  APROVADO: { label: 'Aprovado', tone: 'success' },
  DEVOLVIDO: { label: 'Devolvido', tone: 'danger' },
};

export const SITUACAO_RELATORIO: Record<SituacaoRelatorio, StatusInfo> = {
  AGUARDANDO_ENVIO: { label: 'Aguardando envio', tone: 'neutral' },
  ATRASADO: { label: 'Atrasado', tone: 'danger' },
  EM_ANALISE: { label: 'Em análise', tone: 'warning' },
  DEVOLVIDO: { label: 'Devolvido para correção', tone: 'danger' },
  APROVADO: { label: 'Aprovado', tone: 'success' },
};
