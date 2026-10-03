import api from './api';
import type { AuthResponse } from '../types/User';

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/api/auth/login', { email, password });
  return response.data;
}
