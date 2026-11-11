import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService, NotAdminError } from './core/auth.service';
import { User } from './core/models';

function user(role: User['role']): User {
  return { id: '1', name: 'Ana', email: 'ana@example.com', role };
}

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('guarda a sessão de um ADMIN', async () => {
    const login = service.login('admin@example.com', 'senha');
    http.expectOne('http://localhost:3000/api/auth/login').flush({ user: user('ADMIN'), token: 'abc' });
    await login;

    expect(service.isAuthenticated()).toBe(true);
    expect(service.token()).toBe('abc');
    expect(localStorage.getItem('shopmesh.admin.token')).toBe('abc');
  });

  it('recusa contas que não são ADMIN', async () => {
    const login = service.login('cliente@example.com', 'senha');
    http.expectOne('http://localhost:3000/api/auth/login').flush({ user: user('CUSTOMER'), token: 'xyz' });

    await expect(login).rejects.toBeInstanceOf(NotAdminError);
    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('shopmesh.admin.token')).toBeNull();
  });

  it('logout limpa a sessão', async () => {
    const login = service.login('admin@example.com', 'senha');
    http.expectOne('http://localhost:3000/api/auth/login').flush({ user: user('ADMIN'), token: 'abc' });
    await login;

    service.logout();
    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('shopmesh.admin.user')).toBeNull();
  });
});
