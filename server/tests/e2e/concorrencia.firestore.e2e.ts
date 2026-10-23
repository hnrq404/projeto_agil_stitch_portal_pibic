/**
 * Garantias que só aparecem com acessos simultâneos, conferidas no emulador do
 * Firestore (os repositórios em memória são sequenciais por natureza):
 * protocolo sem repetição, cota que não estoura, e unicidade de e-mail,
 * candidatura e contador de tentativas.
 */
import { randomUUID } from 'node:crypto';

import { buildApp, type AppContainer } from '../../src/infra/config/app.container';
import { obterFirestore } from '../../src/infra/firestore/firestore.client';
import { createFirestoreRateLimitStore } from '../../src/infra/firestore/firestore.rate-limit.store';
import type { Inscricao } from '../../src/modules/inscricoes/domain/inscricoes.types';
import { ConflictError } from '../../src/shared/errors/domain.errors';
import { InMemoryArquivoStorage } from '../../src/shared/storage/arquivo.storage';

jest.setTimeout(60000);

let container: AppContainer;

beforeAll(() => {
  container = buildApp({ persistencia: 'firestore', jwtSecret: 'concorrencia', arquivoStorage: new InMemoryArquivoStorage() });
});

beforeEach(async () => {
  await container.usuariosRepository.clear();
});

afterAll(async () => {
  await container.disconnect?.();
});

function inscricao(dados: Partial<Inscricao> = {}): Inscricao {
  const agora = new Date('2026-09-14T12:00:00.000Z');
  return {
    id: randomUUID(),
    protocolo: null,
    editalId: 'edital-1',
    discenteId: null,
    orientadorId: 'prof-1',
    titulo: 'Projeto',
    subareaCode: '1.03',
    subareaNome: 'Ciência da Computação',
    palavrasChave: '',
    resumo: '',
    objetivos: '',
    metodologia: '',
    status: 'AVALIADA',
    anexos: [],
    homologacaoJustificativa: null,
    divulgadaEm: null,
    submetidaEm: null,
    homologadaEm: null,
    criadoEm: agora,
    atualizadoEm: agora,
    ...dados,
  };
}

describe('Concorrência no Firestore', () => {
  it('20 envios simultâneos recebem protocolos 1..20, sem repetir', async () => {
    const numeros = await Promise.all(
      Array.from({ length: 20 }, () => container.inscricoesRepository.proximoSequencialProtocolo(2026)),
    );
    expect([...numeros].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('homologações simultâneas não passam da cota da subárea', async () => {
    const candidatas = Array.from({ length: 5 }, () => inscricao());
    for (const c of candidatas) await container.inscricoesRepository.create(c);

    const resultados = await Promise.all(
      candidatas.map((c) =>
        container.inscricoesRepository.aprovarDentroDaCota({ ...c, status: 'APROVADA' }, 2),
      ),
    );

    expect(resultados.filter((r) => r.salva)).toHaveLength(2);
    const aprovadas = await container.inscricoesRepository.list({ editalId: 'edital-1', status: ['APROVADA'] });
    expect(aprovadas).toHaveLength(2);
  });

  it('dois cadastros simultâneos com o mesmo e-mail: só um entra', async () => {
    const novo = () => ({
      id: randomUUID(),
      nome: 'Maria',
      email: 'maria@pibic.edu.br',
      senhaHash: 'x',
      role: 'DISCENTE' as const,
      departamento: '',
      matricula: null,
      criadoEm: new Date(),
    });
    const resultados = await Promise.allSettled([
      container.usuariosRepository.create(novo()),
      container.usuariosRepository.create(novo()),
    ]);

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const recusado = resultados.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(recusado.reason).toBeInstanceOf(ConflictError);
    expect(await container.usuariosRepository.list()).toHaveLength(1);
  });

  it('candidatura em dobro (clique duplo) grava uma só, e apagar libera nova candidatura', async () => {
    const nova = () => ({
      id: randomUUID(),
      inscricaoId: 'projeto-1',
      discenteId: 'aluno-1',
      mensagem: 'Quero participar',
      status: 'PENDENTE' as const,
      criadoEm: new Date(),
      respondidaEm: null,
    });
    const resultados = await Promise.allSettled([
      container.candidaturasRepository.create(nova()),
      container.candidaturasRepository.create(nova()),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

    const gravada = await container.candidaturasRepository.findByInscricaoAndDiscente('projeto-1', 'aluno-1');
    await container.candidaturasRepository.delete(gravada!.id);
    await expect(container.candidaturasRepository.create(nova())).resolves.toMatchObject({ discenteId: 'aluno-1' });
  });

  it('o contador de tentativas soma certo com requisições simultâneas', async () => {
    const store = createFirestoreRateLimitStore(obterFirestore());
    const agora = Date.now();
    await Promise.all(Array.from({ length: 8 }, () => store.incrementar('login:1.2.3.4', agora, 60_000)));
    expect((await store.consultar('login:1.2.3.4', agora)).count).toBe(8);
    // Depois da janela, recomeça do zero.
    expect((await store.consultar('login:1.2.3.4', agora + 60_001)).count).toBe(0);
  });
});
