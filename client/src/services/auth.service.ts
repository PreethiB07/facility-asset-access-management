import api, { TOKEN_KEY } from './api';
import type { AuthTokenResponse, User } from '../types';

export const authApi = {
  async register(name: string, email: string, password: string): Promise<AuthTokenResponse> {
    const { data } = await api.post<AuthTokenResponse>('/auth/register', {
      name,
      email,
      password,
    });
    return data;
  },

  async login(email: string, password: string): Promise<AuthTokenResponse> {
    const { data } = await api.post<AuthTokenResponse>('/auth/login', { email, password });
    return data;
  },

  async me(): Promise<User> {
    const { data } = await api.get<User>('/auth/me');
    return data;
  },

  saveToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },

  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  },

  getStoredToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
};
