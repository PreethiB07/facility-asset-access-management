import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPage from '../pages/AdminPage';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import AdminRoute from '../routes/AdminRoute';
import ProtectedRoute from '../routes/ProtectedRoute';
import { authApi } from '../services/auth.service';
import { facilityApi } from '../services/facility.service';

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

vi.mock('../services/facility.service', () => ({
  facilityApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../services/area.service', () => ({
  areaApi: {
    listByFacility: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../services/asset.service', () => ({
  assetApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

function renderAdminRoute(role: 'USER' | 'MANAGER' | 'ADMIN') {
  vi.mocked(authApi.getStoredToken).mockReturnValue('token');
  vi.mocked(authApi.me).mockResolvedValue({
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    role,
    isActive: true,
  });

  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<AdminPage />} />
              </Route>
              <Route path="/dashboard" element={<div>Dashboard redirected</div>} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('Admin access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.getStoredToken).mockReturnValue('token');
    vi.mocked(facilityApi.list).mockResolvedValue([]);
  });

  it('ADMIN can access admin pages', async () => {
    renderAdminRoute('ADMIN');
    expect(await screen.findByRole('heading', { name: /administration/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /facilities/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(facilityApi.list).toHaveBeenCalled();
    });
  });

  it('USER cannot access admin pages', async () => {
    renderAdminRoute('USER');
    await waitFor(() => {
      expect(screen.getByText('Dashboard redirected')).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: /administration/i })).not.toBeInTheDocument();
  });

  it('MANAGER cannot access admin pages', async () => {
    renderAdminRoute('MANAGER');
    await waitFor(() => {
      expect(screen.getByText('Dashboard redirected')).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: /administration/i })).not.toBeInTheDocument();
  });
});
