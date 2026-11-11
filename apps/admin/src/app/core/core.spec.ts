import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { adminGuard, guestGuard } from './auth.guard';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { errorMessage } from './errors';
import { User } from './models';

const admin: User = { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ADMIN' };

async function loginAsAdmin(http: HttpTestingController) {
  const auth = TestBed.inject(AuthService);
  const login = auth.login('ana@example.com', 'senha');
  http.expectOne('http://localhost:3000/api/auth/login').flush({ user: admin, token: 'abc' });
  await login;
  return auth;
}

describe('errorMessage', () => {
  it('prioriza a mensagem devolvida pelo serviço', () => {
    const error = new HttpErrorResponse({ status: 409, error: { message: 'Email já cadastrado' } });
    expect(errorMessage(error, 'fallback')).toBe('Email já cadastrado');
  });

  it('explica quando o gateway está fora do ar', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 0 }), 'fallback')).toContain('API Gateway');
  });

  it('usa o fallback quando não há mensagem', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 500, error: null }), 'fallback')).toBe('fallback');
    expect(errorMessage('qualquer coisa', 'fallback')).toBe('fallback');
  });
});

describe('guards e interceptor de autenticação', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('adminGuard redireciona para o login guardando o destino', () => {
    const result = TestBed.runInInjectionContext(() =>
      adminGuard({} as never, { url: '/orders' } as never),
    );

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login?redirect=%2Forders');
  });

  it('adminGuard libera e guestGuard bloqueia quando há sessão de ADMIN', async () => {
    await loginAsAdmin(http);

    expect(TestBed.runInInjectionContext(() => adminGuard({} as never, { url: '/' } as never))).toBe(true);
    expect(TestBed.runInInjectionContext(() => guestGuard({} as never, {} as never))).toBeInstanceOf(UrlTree);
  });

  it('o interceptor envia o Bearer token, mas não no login', async () => {
    await loginAsAdmin(http);
    const client = TestBed.inject(HttpClient);

    client.get('/api/orders').subscribe();
    expect(http.expectOne('/api/orders').request.headers.get('Authorization')).toBe('Bearer abc');

    client.post('http://localhost:3000/api/auth/login', {}).subscribe();
    expect(http.expectOne('http://localhost:3000/api/auth/login').request.headers.has('Authorization')).toBe(false);
  });

  it('resposta 401 encerra a sessão e volta ao login', async () => {
    const auth = await loginAsAdmin(http);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    TestBed.inject(HttpClient).get('/api/orders').subscribe({ error: () => undefined });
    http.expectOne('/api/orders').flush({ message: 'expirado' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { expired: 1 } });
  });
});
