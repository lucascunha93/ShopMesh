import axios from 'axios';

export const SESSION_EXPIRED_EVENT = 'shopmesh:session-expired';

const api = axios.create({
  // Ordem: config.js em tempo de execução (container), variável do Vite, padrão local.
  baseURL: window.SHOPMESH_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('shopmesh.token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (!axios.isCancel(error)) {
      // Token expirado ou recusado em uma rota protegida: encerra a sessão local.
      // Falhas do próprio login não contam, pois significam credenciais erradas.
      if (axios.isAxiosError(error)
        && error.response?.status === 401
        && error.config?.headers?.Authorization
        && !error.config.url?.startsWith('/api/auth/login')) {
        localStorage.removeItem('shopmesh.token');
        localStorage.removeItem('shopmesh.user');
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }

      if (axios.isAxiosError(error)) {
        console.error('[api] Request failed', {
          method: error.config?.method,
          url: error.config?.url?.split('?')[0],
          status: error.response?.status,
          code: error.code,
          message: error.message,
        });
      } else {
        console.error('[api] Request failed', {
          errorName: error instanceof Error ? error.name : typeof error,
        });
      }
    }

    return Promise.reject(error);
  },
);

export default api;
