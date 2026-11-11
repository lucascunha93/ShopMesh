import api from './api';
import type { AuthResponse } from '../types/User';

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/api/auth/login', { email, password });
  return response.data;
}

export async function register(name: string, email: string, password: string): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/api/auth/register', { name, email, password });
  return response.data;
}
