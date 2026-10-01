/** Tipos de notificação in-app do portal, um por evento de domínio relevante ao usuário. */
export type NotificacaoTipo =
  | 'EDITAL_PUBLICADO'
  | 'EDITAL_ENCERRADO'
  | 'VINCULO_SOLICITADO'
  | 'VINCULO_RESPONDIDO'
  | 'AVALIACAO_ATRIBUIDA'
  | 'INSCRICAO_RESULTADO'
  | 'RELATORIO_ENVIADO'
  | 'RELATORIO_AVALIADO';

/** Conteúdo de uma notificação direcionada (sem destinatário nem metadados). */
export interface NotificacaoInput {
  tipo: NotificacaoTipo;
  titulo: string;
  mensagem: string;
  referenceId?: string;
}

export interface Notificacao {
  id: string;
  userId: string;
  tipo: NotificacaoTipo;
  titulo: string;
  mensagem: string;
  /** Referência opcional à entidade que originou o evento (ex.: id do edital). */
  referenceId?: string;
  lida: boolean;
  criadoEm: Date;
}

/** Evento de domínio emitido quando um edital é publicado — consumido pelo módulo de notificações. */
export interface EditalPublicadoEvent {
  editalId: string;
  numero: string;
  titulo: string;
  tipoBolsa: string;
  totalCotas: number;
  dataFimInscricoes: Date;
}
