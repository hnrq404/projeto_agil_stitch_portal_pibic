/** Ações administrativas registradas na trilha de auditoria. */
export const ACOES_AUDITORIA = [
  'EDITAL_CRIADO',
  'EDITAL_EDITADO',
  'EDITAL_PUBLICADO',
  'EDITAL_ENCERRADO',
  'AVALIADORES_ATRIBUIDOS',
  'ATRIBUICAO_REMOVIDA',
  'INSCRICAO_HOMOLOGADA',
  'USUARIO_ATUALIZADO',
] as const;

export type AcaoAuditoria = (typeof ACOES_AUDITORIA)[number];

export const ENTIDADES_AUDITORIA = ['EDITAL', 'INSCRICAO', 'AVALIACAO', 'USUARIO'] as const;

export type EntidadeAuditoria = (typeof ENTIDADES_AUDITORIA)[number];

export interface RegistroAuditoria {
  id: string;
  actorId: string;
  actorNome: string;
  acao: AcaoAuditoria;
  entidade: EntidadeAuditoria;
  entidadeId: string;
  detalhes: Record<string, unknown>;
  criadoEm: Date;
}

export interface FiltroAuditoria {
  entidade?: EntidadeAuditoria;
  entidadeId?: string;
  actorId?: string;
  /** Quantos registros devolver, do mais recente para o mais antigo. */
  limite: number;
}
