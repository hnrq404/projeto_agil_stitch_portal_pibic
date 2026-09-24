import type { Clock } from '../time/clock';

/** Clock determinístico para testes — começa fixo e pode ser avançado pelo teste. */
export class FixedClock implements Clock {
  private current: Date;

  constructor(initial?: Date | string) {
    this.current = initial ? new Date(initial) : new Date('2026-09-14T12:00:00.000Z');
  }

  now(): Date {
    return this.current;
  }

  /** Avança o relógio (dias, horas, etc.) — simula passagem do tempo nos testes. */
  advanceMs(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }

  setTo(date: Date | string): void {
    this.current = new Date(date);
  }
}
