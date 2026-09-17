/** Tipos de notificação in-app do portal (Sprint 2 entrega o evento de publicação de edital). */
export type NotificacaoTipo = 'EDITAL_PUBLICADO' | 'EDITAL_ENCERRADO';

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
