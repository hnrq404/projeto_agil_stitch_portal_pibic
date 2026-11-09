import { InMemoryNotificacoesRepository } from '@notificacoes/repositories/notificacoes.repository';
import { NotificacoesService } from '@notificacoes/notificacoes.service';

function buildService() {
  const repository = new InMemoryNotificacoesRepository();
  const recipients = [{ id: 'user-1' }, { id: 'user-2' }, { id: 'user-3' }];
  const service = new NotificacoesService(repository, { listUsers: () => recipients });
  return { repository, service };
}

const event = {
  editalId: 'edital-1',
  numero: '06/2026',
  titulo: 'Edital PIBIC 2026/2027',
  tipoBolsa: 'PIBIC',
  totalCotas: 10,
  dataFimInscricoes: new Date('2026-10-31T23:59:59.000Z'),
};

describe('NotificacoesService.handleEditalPublicado', () => {
  it('cria uma notificação para cada usuário cadastrado', async () => {
    const { repository, service } = buildService();

    await service.handleEditalPublicado(event);

    const usuarios = ['user-1', 'user-2', 'user-3'];
    const porUsuario = await Promise.all(usuarios.map((userId) => repository.listByUser(userId)));

    const notificacaoEsperada = expect.objectContaining({
      tipo: 'EDITAL_PUBLICADO',
      referenceId: 'edital-1',
      lida: false,
      mensagem: expect.stringContaining('06/2026'),
    });
    expect(porUsuario).toEqual(usuarios.map(() => [notificacaoEsperada]));
  });

  it('é idempotente: republicar o mesmo edital não duplica notificações', async () => {
    const { repository, service } = buildService();

    await service.handleEditalPublicado(event);
    await service.handleEditalPublicado(event);

    const list = await repository.listByUser('user-1');
    expect(list).toHaveLength(1);
  });

  it('não confunde eventos de editais diferentes', async () => {
    const { repository, service } = buildService();

    await service.handleEditalPublicado(event);
    await service.handleEditalPublicado({ ...event, editalId: 'edital-2', numero: '07/2026' });

    const list = await repository.listByUser('user-1');
    expect(list).toHaveLength(2);
  });
});
