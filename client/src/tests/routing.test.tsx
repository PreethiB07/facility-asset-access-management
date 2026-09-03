import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import DashboardPage from '../pages/DashboardPage';
import ProtectedRoute from '../routes/ProtectedRoute';
import { authApi } from '../services/auth.service';

vi.mock('../services/auth.service', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    me: vi.fn(),
    saveToken: vi.fn(),
    clearToken: vi.fn(),
    getStoredToken: vi.fn(() => null),
  },
}));

vi.mock('../services/api', () => ({
  default: {},
  TOKEN_KEY: 'faam_token',
  setUnauthorizedHandler: vi.fn(),
}));

vi.mock('../services/accessRequest.service', () => ({
  accessRequestApi: {
    list: vi.fn().mockResolvedValue([]),
    getMyAccess: vi.fn().mockResolvedValue([]),
    listPending: vi.fn().mockResolvedValue([]),
  },
}));

describe('Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('unauthenticated user is redirected to login', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<div>Login page</div>} />
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<DashboardPage />} />
              </Route>
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Login page')).toBeInTheDocument();
    });
  });

  it('authenticated user can access protected page', async () => {
    vi.mocked(authApi.getStoredToken).mockReturnValue('token');
    vi.mocked(authApi.me).mockResolvedValue({
      id: '1',
      name: 'Test User',
      email: 'user@example.com',
      role: 'USER',
      isActive: true,
      companyId: '00000000-0000-4000-8000-000000000001',
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<div>Login page</div>} />
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<DashboardPage />} />
              </Route>
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: /welcome back, test user/i })).toBeInTheDocument();
  });
});

describe('App routes', () => {
  it('renders login route', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  });
});
