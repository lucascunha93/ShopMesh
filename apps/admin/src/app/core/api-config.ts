import { InjectionToken } from '@angular/core';

/**
 * URL base do API Gateway. Pode ser sobrescrita em tempo de execução definindo
 * `window.SHOPMESH_API_URL` em `config.js` (servido junto com a aplicação).
 */
export const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',
  factory: () => {
    const runtimeUrl = (globalThis as { SHOPMESH_API_URL?: string }).SHOPMESH_API_URL;
    return (runtimeUrl || 'http://localhost:3000').replace(/\/$/, '');
  },
});
