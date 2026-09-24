import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { api, clearToken, getToken, setToken } from '../services/api';
import type { AuthResponse, AuthUser } from '../types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isGestor: boolean;
  login(email: string, senha: string): Promise<AuthUser>;
  register(input: { nome: string; email: string; senha: string; role: 'GESTOR' | 'USUARIO' }): Promise<AuthUser>;
  logout(): void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Bootstrap: se há token salvo, valida contra /api/auth/me.
  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get<{ usuario: AuthUser }>('/api/auth/me');
        if (!cancelled) setUser(res.usuario);
      } catch {
        clearToken();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, senha: string) => {
    const res = await api.post<AuthResponse>('/api/auth/login', { email, senha });
    setToken(res.token);
    setUser(res.usuario);
    return res.usuario;
  }, []);

  const register = useCallback(
    async (input: { nome: string; email: string; senha: string; role: 'GESTOR' | 'USUARIO' }) => {
      const res = await api.post<AuthResponse>('/api/auth/register', input);
      setToken(res.token);
      setUser(res.usuario);
      return res.usuario;
    },
    [],
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isGestor: user?.role === 'GESTOR',
      login,
      register,
      logout,
    }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de <AuthProvider>.');
  }
  return ctx;
}
