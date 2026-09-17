import express, { type Express, type Router } from 'express';

import { SystemClock, type Clock } from '@shared/time/clock';
import {
  createAuthenticationGuard,
  type UserDirectory,
} from '@shared/auth/auth.middleware';

import { EditaisService, type EditalEventsPort } from '@editais/editais.service';
import { InMemoryEditaisRepository, type EditaisRepository } from '@editais/repositories/editais.repository';
import { registerEditaisRoutes } from '@editais/editais.controller';
import { NotificacoesService } from '@notificacoes/notificacoes.service';
import {
  InMemoryNotificacoesRepository,
  type NotificacoesRepository,
} from '@notificacoes/repositories/notificacoes.repository';
import { registerNotificacoesRoutes } from '@notificacoes/notificacoes.controller';
import { registerPublicoRoutes } from '@publico/publico.controller';
import { errorHandler } from '@shared/http/http.middleware';

export interface AppContainerOptions {
  clock?: Clock;
  editaisRepository?: EditaisRepository;
  notificacoesRepository?: NotificacoesRepository;
  userDirectory?: UserDirectory & { listUsers(): { id: string }[] };
}

export interface AppContainer {
  app: Express;
  clock: Clock;
  editaisRepository: EditaisRepository;
  notificacoesRepository: NotificacoesRepository;
  editaisService: EditaisService;
  notificacoesService: NotificacoesService;
}

/** Porta de eventos: o service de editais notifica o módulo de notificações via este adapter. */
function createEditalEventsAdapter(notificacoesService: NotificacoesService): EditalEventsPort {
  return {
    onEditalPublicado: (event) => notificacoesService.handleEditalPublicado(event),
  };
}

/**
 * Composição de dependências da aplicação.
 * Usada tanto pelo bootstrap (index.ts) quanto pelos testes de integração/E2E
 * (que injetam repositórios frescos e um clock congelado).
 */
export function buildApp(options: AppContainerOptions = {}): AppContainer {
  const clock = options.clock ?? new SystemClock();
  const editaisRepository = options.editaisRepository ?? new InMemoryEditaisRepository();
  const notificacoesRepository =
    options.notificacoesRepository ?? new InMemoryNotificacoesRepository();
  const userDirectory =
    options.userDirectory ??
    ({
      resolveUser: () => undefined,
      listUsers: () => [],
    } satisfies UserDirectory & { listUsers(): { id: string }[] });

  const notificacoesService = new NotificacoesService(notificacoesRepository, userDirectory);
  const editaisService = new EditaisService(editaisRepository, clock, createEditalEventsAdapter(notificacoesService));

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const router: Router = express.Router();
  const authenticationGuard = createAuthenticationGuard(userDirectory);

  registerEditaisRoutes(router, editaisService, authenticationGuard);
  registerNotificacoesRoutes(router, notificacoesService, authenticationGuard);
  registerPublicoRoutes(router, editaisService, clock);

  app.use(router);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'portal-pibic-server', sprint: 'S2' });
  });

  app.use(errorHandler);

  return {
    app,
    clock,
    editaisRepository,
    notificacoesRepository,
    editaisService,
    notificacoesService,
  };
}
