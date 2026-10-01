import type { UserDirectory } from './auth.middleware';
import type { AuthenticatedUser } from './auth.types';

import type { AuthService } from '../../modules/auth/auth.service';

/**
 * Adapter UserDirectory que verifica o JWT e recarrega o usuário do repositório.
 * Recarregar (em vez de confiar no papel embutido no token) garante que uma
 * troca de papel feita pelo gestor vale na próxima requisição (RN11) e que
 * contas removidas perdem o acesso imediatamente.
 */
export class JwtUserDirectory implements UserDirectory {
  constructor(private readonly authService: AuthService) {}

  async resolveUser(token: string): Promise<AuthenticatedUser | undefined> {
    try {
      const usuario = await this.authService.resolveToken(token);
      return {
        id: usuario.id,
        name: usuario.nome,
        email: usuario.email,
        role: usuario.role,
      };
    } catch {
      return undefined;
    }
  }
}
