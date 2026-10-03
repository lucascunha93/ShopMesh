import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import * as authService from '../services/auth';
import type { User } from '../types/User';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser(): User | null {
  try {
    const value = localStorage.getItem('shopmesh.user');
    return value ? JSON.parse(value) as User : null;
  } catch {
    localStorage.removeItem('shopmesh.user');
    return null;
  }
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [user, setUser] = useState<User | null>(readStoredUser);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('shopmesh.token'));

  const value = useMemo(() => ({
    user,
    token,
    async login(email: string, password: string) {
      const result = await authService.login(email, password);
      localStorage.setItem('shopmesh.token', result.token);
      localStorage.setItem('shopmesh.user', JSON.stringify(result.user));
      setToken(result.token);
      setUser(result.user);
    },
    logout() {
      localStorage.removeItem('shopmesh.token');
      localStorage.removeItem('shopmesh.user');
      setToken(null);
      setUser(null);
    },
    isAuthenticated: Boolean(token && user),
  }), [token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }

  return context;
}
