import express from 'express';
import request from 'supertest';
import { z } from 'zod';

import { comPrazo, errorHandler, prazoDaRequisicao } from '../../src/shared/http/http.middleware';
import { createMemoryRateLimitStore } from '../../src/shared/http/security.middleware';
import { listaLimitada } from '../../src/shared/validation/lista';

// Correções vindas dos testes finais (testes-finais/): estresse e segurança.

describe('listaLimitada', () => {
  const schema = listaLimitada(z.array(z.string().min(1)).max(3), 3);

  it('aceita listas dentro do limite', () => {
    expect(schema.parse(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('recusa listas acima do limite validando só max + 1 itens', () => {
    const resultado = schema.safeParse(Array(100_000).fill(1));

    expect(resultado.success).toBe(false);
    // 4 itens de tipo errado + "acima do máximo": nunca um erro por item recebido.
    expect(resultado.error!.issues.length).toBeLessThanOrEqual(5);
    expect(resultado.error!.issues.some((i) => i.code === 'too_big')).toBe(true);
  });

  it('continua exigindo o campo', () => {
    expect(z.object({ ids: schema }).safeParse({}).success).toBe(false);
  });
});

describe('comPrazo', () => {
  it('devolve o resultado quando a promessa termina a tempo', async () => {
    await expect(comPrazo(Promise.resolve('ok'), 100)).resolves.toBe('ok');
  });

  it('rejeita quando a promessa passa do prazo (ex.: banco fora do ar)', async () => {
    await expect(comPrazo(new Promise(() => undefined), 20)).rejects.toThrow('Prazo de 20 ms esgotado');
  });
});

describe('prazoDaRequisicao', () => {
  function app() {
    const a = express();
    a.use(prazoDaRequisicao(50));
    a.get('/pendurada', () => undefined);
    a.get('/rapida', (_req, res) => {
      res.json({ ok: true });
    });
    a.get('/atrasada-e-falha', (_req, _res, next) => {
      setTimeout(() => next(new Error('falhou depois do prazo')), 80);
    });
    a.use(errorHandler);
    return a;
  }

  it('responde 503 em JSON quando a rota não termina no prazo', async () => {
    const res = await request(app()).get('/pendurada');

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('não interfere nas rotas que respondem a tempo', async () => {
    const res = await request(app()).get('/rapida');
    expect(res.status).toBe(200);
  });

  it('um erro depois do 503 não tenta responder de novo', async () => {
    const res = await request(app()).get('/atrasada-e-falha');
    expect(res.status).toBe(503);
  });
});

describe('store do limite de tentativas em memória', () => {
  it('devolve uma tentativa reservada e não deixa o contador negativo', async () => {
    const store = createMemoryRateLimitStore();
    const agora = Date.now();

    await store.incrementar('login:ip:conta', agora, 60_000);
    await store.decrementar('login:ip:conta', agora, 60_000);
    await store.decrementar('login:ip:conta', agora, 60_000);

    expect((await store.consultar('login:ip:conta', agora, 60_000)).count).toBe(0);
  });
});
