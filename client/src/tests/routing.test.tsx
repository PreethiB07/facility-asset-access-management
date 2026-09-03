import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { AuthProvider } from '../context/AuthContext';
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
          <Routes>
            <Route path="/login" element={<div>Login page</div>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
            </Route>
          </Routes>
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
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>Login page</div>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
  });
});

describe('App routes', () => {
  it('renders login route', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  });
});
