import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SESSION_EXPIRED_EVENT } from '../services/api';
import * as authService from '../services/auth';
import type { AuthResponse, User } from '../types/User';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
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

  useEffect(() => {
    // O interceptor da API avisa quando o token expira ou é recusado.
    function handleSessionExpired() {
      setToken(null);
      setUser(null);
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  const value = useMemo(() => {
    function storeSession(result: AuthResponse) {
      localStorage.setItem('shopmesh.token', result.token);
      localStorage.setItem('shopmesh.user', JSON.stringify(result.user));
      setToken(result.token);
      setUser(result.user);
    }

    return {
      user,
      token,
      async login(email: string, password: string) {
        storeSession(await authService.login(email, password));
      },
      async register(name: string, email: string, password: string) {
        storeSession(await authService.register(name, email, password));
      },
      logout() {
        localStorage.removeItem('shopmesh.token');
        localStorage.removeItem('shopmesh.user');
        setToken(null);
        setUser(null);
      },
      isAuthenticated: Boolean(token && user),
    };
  }, [token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }

  return context;
}
