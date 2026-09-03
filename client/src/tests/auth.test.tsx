import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../context/AuthContext';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
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

function renderLogin(initialEntry = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>Dashboard page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.getStoredToken).mockReturnValue(null);
  });

  it('login form renders', () => {
    renderLogin();
    expect(screen.getByLabelText(/^email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('validation works', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: /login/i }));

    expect(await screen.findByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
  });

  it('loading state works', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.login).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                token: 'test-token',
                user: {
                  id: '1',
                  name: 'Test User',
                  email: 'user@example.com',
                  role: 'USER',
                  isActive: true,
                },
              }),
            100,
          );
        }),
    );
    vi.mocked(authApi.me).mockResolvedValue({
      id: '1',
      name: 'Test User',
      email: 'user@example.com',
      role: 'USER',
      isActive: true,
    });

    renderLogin();

    await user.type(screen.getByLabelText(/^email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
  });

  it('successful login redirects', async () => {
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

    await user.type(screen.getByLabelText(/^email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
  });

  it('failed login displays safe message', async () => {
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

    await user.type(screen.getByLabelText(/^email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'wrong');
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

describe('Registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.getStoredToken).mockReturnValue(null);
  });

  it('password confirmation validation', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AuthProvider>
          <RegisterPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await user.type(await screen.findByLabelText(/^name/i), 'Test User');
    await user.type(screen.getByLabelText(/^email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'password123');
    await user.type(screen.getByLabelText(/^confirm password/i), 'different');
    await user.click(screen.getByRole('button', { name: /register/i }));

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
  });

  it('role cannot be selected', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <RegisterPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/admin/i)).not.toBeInTheDocument();
  });

  it('password visibility works', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AuthProvider>
          <RegisterPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    const showButtons = await screen.findAllByRole('button', { name: /show password/i });
    await user.click(showButtons[0]);
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute('type', 'text');
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
