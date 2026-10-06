import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
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
