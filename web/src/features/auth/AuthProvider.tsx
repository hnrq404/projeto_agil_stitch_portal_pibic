import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { http, SESSION_EXPIRED_EVENT, tokenStorage } from '@/shared/api/http';
import type { AuthResponse, RegistroRole, UserRole, Usuario } from '@/shared/types/api';

export interface RegisterInput {
  nome: string;
  email: string;
  senha: string;
  role: RegistroRole;
  departamento?: string;
  matricula?: string;
}

interface AuthContextValue {
  user: Usuario | null;
  loading: boolean;
  /** true quando a sessão caiu por expiração (mensagem na tela de login). */
  sessionExpired: boolean;
  hasRole(...roles: UserRole[]): boolean;
  login(email: string, senha: string): Promise<Usuario>;
  register(input: RegisterInput): Promise<Usuario>;
  logout(): void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(() => Boolean(tokenStorage.get()));
  const [sessionExpired, setSessionExpired] = useState(false);

  // Bootstrap: com token salvo, confirma a sessão e o papel atual em /me.
  useEffect(() => {
    if (!tokenStorage.get()) return;
    let cancelled = false;
    http
      .get<{ usuario: Usuario }>('/api/auth/me')
      .then((res) => !cancelled && setUser(res.usuario))
      .catch(() => tokenStorage.clear())
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // RN12: qualquer 401 com sessão ativa derruba a sessão e leva ao login.
  useEffect(() => {
    function onExpired() {
      setUser(null);
      setSessionExpired(true);
      queryClient.clear();
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [queryClient]);

  const startSession = useCallback(
    (res: AuthResponse) => {
      queryClient.clear();
      tokenStorage.set(res.token);
      setSessionExpired(false);
      setUser(res.usuario);
      return res.usuario;
    },
    [queryClient],
  );

  const login = useCallback(
    async (email: string, senha: string) => startSession(await http.post<AuthResponse>('/api/auth/login', { email, senha })),
    [startSession],
  );

  const register = useCallback(
    async (input: RegisterInput) => startSession(await http.post<AuthResponse>('/api/auth/register', input)),
    [startSession],
  );

  const logout = useCallback(() => {
    tokenStorage.clear();
    queryClient.clear();
    setUser(null);
  }, [queryClient]);

  const hasRole = useCallback((...roles: UserRole[]) => Boolean(user && roles.includes(user.role)), [user]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, sessionExpired, hasRole, login, register, logout }),
    [user, loading, sessionExpired, hasRole, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>.');
  return ctx;
}

/** Usuário logado garantido (use apenas dentro de rotas protegidas). */
export function useCurrentUser(): Usuario {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser exige sessão ativa (rota protegida).');
  return user;
}
