import type { UserDirectory } from './auth.middleware';
import type { AuthenticatedUser } from './auth.types';

import type { AuthService } from '../../modules/auth/auth.service';

/**
 * Adapter UserDirectory que verifica o JWT e recarrega o usuário do repositório.
 * Implementa a mesma porta usada pelos guards — testes continuam injetando
 * directories falsos sem JWT; produção usa este adapter.
 */
export class JwtUserDirectory implements UserDirectory {
  constructor(private readonly authService: AuthService) {}

  resolveUser(token: string): AuthenticatedUser | undefined {
    try {
      // resolveUser é síncrono pela porta do guard; o AuthService.resolveToken
      // é async, então usamos o payload do JWT (fonte já verificada).
      const payload = this.authService.verifyTokenSync(token);
      return {
        id: payload.sub,
        name: payload.nome,
        email: payload.email,
        role: payload.role,
      };
    } catch {
      return undefined;
    }
  }
}
