import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, NotAdminError } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  template: `
    <section class="login">
      <form class="card login__card" [formGroup]="form" (ngSubmit)="submit()">
        <span class="brand__mark">S</span>
        <h1>Painel ShopMesh</h1>
        <p class="muted">Acesso restrito a administradores.</p>

        @if (expired) {
          <p class="alert alert--info" role="status">Sua sessão expirou. Entre novamente.</p>
        }
        @if (error()) {
          <p class="alert alert--error" role="alert">{{ error() }}</p>
        }

        <label class="field">
          <span>Email</span>
          <input type="email" formControlName="email" autocomplete="email" placeholder="admin@shopmesh.local" />
        </label>
        <label class="field">
          <span>Senha</span>
          <input type="password" formControlName="password" autocomplete="current-password" />
        </label>
        <button type="submit" class="btn btn--primary btn--block" [disabled]="form.invalid || submitting()">
          {{ submitting() ? 'Entrando...' : 'Entrar' }}
        </button>
      </form>
    </section>
  `,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly submitting = signal(false);
  protected readonly error = signal('');
  protected readonly expired = this.route.snapshot.queryParamMap.has('expired');

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      return;
    }
    this.submitting.set(true);
    this.error.set('');

    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.login(email, password);
      const redirect = this.route.snapshot.queryParamMap.get('redirect');
      // Aceita apenas caminhos internos.
      await this.router.navigateByUrl(redirect?.startsWith('/') && !redirect.startsWith('//') ? redirect : '/');
    } catch (error) {
      if (error instanceof NotAdminError) {
        this.error.set(error.message);
      } else if (error instanceof HttpErrorResponse && error.status === 401) {
        this.error.set('Credenciais inválidas.');
      } else {
        this.error.set(errorMessage(error, 'Não foi possível entrar.'));
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
