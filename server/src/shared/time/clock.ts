/** Porta de relógio — permite congelar tempo nos testes e isolar as regras de prazo. */
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
