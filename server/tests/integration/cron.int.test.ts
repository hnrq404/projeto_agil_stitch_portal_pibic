import request from 'supertest';

import { buildTestApp } from '../helpers/app';

describe('Rotas de tarefas agendadas (Vercel Cron)', () => {
  const anterior = process.env['CRON_SECRET'];

  afterEach(() => {
    if (anterior === undefined) delete process.env['CRON_SECRET'];
    else process.env['CRON_SECRET'] = anterior;
  });

  it('só rodam com o segredo enviado pela Vercel', async () => {
    process.env['CRON_SECRET'] = 'segredo-do-cron';
    const { app } = buildTestApp({ jwtSecret: 'cron' });

    expect((await request(app).get('/api/cron/encerrar-editais')).status).toBe(401);
    expect(
      (await request(app).get('/api/cron/encerrar-editais').set('Authorization', 'Bearer outro')).status,
    ).toBe(401);

    const ok = await request(app).get('/api/cron/encerrar-editais').set('Authorization', 'Bearer segredo-do-cron');
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ encerrados: 0 });

    const lembretes = await request(app)
      .get('/api/cron/lembretes-relatorio')
      .set('Authorization', 'Bearer segredo-do-cron');
    expect(lembretes.status).toBe(200);
    expect(lembretes.body).toEqual({ enviados: 0 });
  });

  it('sem CRON_SECRET configurado, ficam fechadas', async () => {
    delete process.env['CRON_SECRET'];
    const { app } = buildTestApp({ jwtSecret: 'cron' });
    expect((await request(app).get('/api/cron/encerrar-editais').set('Authorization', 'Bearer ')).status).toBe(401);
  });
});
