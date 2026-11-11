import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from './api-config';
import { AuthResponse, User } from './models';

const TOKEN_KEY = 'shopmesh.admin.token';
const USER_KEY = 'shopmesh.admin.user';

export class NotAdminError extends Error {
  constructor() {
    super('Esta conta não tem acesso ao painel administrativo.');
  }
}

function readStoredUser(): User | null {
  try {
    const value = localStorage.getItem(USER_KEY);
    return value ? (JSON.parse(value) as User) : null;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  private readonly tokenState = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private readonly userState = signal<User | null>(readStoredUser());

  readonly token = this.tokenState.asReadonly();
  readonly user = this.userState.asReadonly();
  readonly isAuthenticated = computed(
    () => Boolean(this.tokenState()) && this.userState()?.role === 'ADMIN',
  );

  async login(email: string, password: string): Promise<void> {
    const result = await firstValueFrom(
      this.http.post<AuthResponse>(`${this.apiUrl}/api/auth/login`, { email, password }),
    );

    // O token de um CUSTOMER seria recusado pelas rotas administrativas.
    if (result.user.role !== 'ADMIN') {
      throw new NotAdminError();
    }

    localStorage.setItem(TOKEN_KEY, result.token);
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    this.tokenState.set(result.token);
    this.userState.set(result.user);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.tokenState.set(null);
    this.userState.set(null);
  }
}
