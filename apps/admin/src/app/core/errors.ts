import { HttpErrorResponse } from '@angular/common/http';

/** Extrai uma mensagem legível das respostas de erro dos serviços. */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'Não foi possível falar com o API Gateway. Verifique se ele está no ar.';
    }
    const body = error.error as { message?: string; error?: string } | null;
    return body?.message || body?.error || fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
