import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../context/AuthContext';
import LoginPage from '../pages/LoginPage';
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

function renderLogin() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('login form renders', () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('validation works', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: /login/i }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  it('successful login updates auth state', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.login).mockResolvedValue({
      token: 'test-token',
      user: {
        id: '1',
        name: 'Test User',
        email: 'user@example.com',
        role: 'USER',
        isActive: true,
      },
    });
    vi.mocked(authApi.me).mockResolvedValue({
      id: '1',
      name: 'Test User',
      email: 'user@example.com',
      role: 'USER',
      isActive: true,
    });

    renderLogin();

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith('user@example.com', 'password123');
      expect(authApi.saveToken).toHaveBeenCalledWith('test-token');
    });
  });

  it('failed login displays error', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.login).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 401,
        data: { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
      },
      config: { url: '/auth/login' },
    });

    renderLogin();

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /login/i }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
  });

  it('logout clears authentication', async () => {
    vi.mocked(authApi.getStoredToken).mockReturnValue('token');
    vi.mocked(authApi.me).mockResolvedValue({
      id: '1',
      name: 'Test User',
      email: 'user@example.com',
      role: 'USER',
      isActive: true,
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <LogoutHarness />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('authenticated')).toBeInTheDocument();
    });

    await userEvent.setup().click(screen.getByRole('button', { name: /logout/i }));

    await waitFor(() => {
      expect(authApi.clearToken).toHaveBeenCalled();
      expect(screen.getByText('guest')).toBeInTheDocument();
    });
  });
});

function LogoutHarness() {
  const { isAuthenticated, logout } = useAuth();
  return (
    <div>
      <span>{isAuthenticated ? 'authenticated' : 'guest'}</span>
      <button type="button" onClick={logout}>
        Logout
      </button>
    </div>
  );
}
