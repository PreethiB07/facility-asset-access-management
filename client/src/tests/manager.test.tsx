import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppLayout from '../components/layout/AppLayout';
import ManagerRequestsPage from '../pages/ManagerRequestsPage';
import { AuthProvider } from '../context/AuthContext';
import { accessRequestApi } from '../services/accessRequest.service';
import { authApi } from '../services/auth.service';

vi.mock('../services/auth.service', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    me: vi.fn(),
    saveToken: vi.fn(),
    clearToken: vi.fn(),
    getStoredToken: vi.fn(() => 'token'),
  },
}));

vi.mock('../services/api', () => ({
  default: {},
  TOKEN_KEY: 'faam_token',
  setUnauthorizedHandler: vi.fn(),
}));

vi.mock('../services/accessRequest.service', () => ({
  accessRequestApi: {
    listPending: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
  },
}));

const pendingRequest = {
  id: 'req-1',
  accessType: 'TEMPORARY' as const,
  startAt: '2030-01-01T09:00:00.000Z',
  endAt: '2030-01-31T17:00:00.000Z',
  reason: 'Maintenance window',
  status: 'PENDING' as const,
  createdAt: '2026-01-01T10:00:00.000Z',
  requester: {
    id: 'user-1',
    name: 'Jane User',
    email: 'jane@example.com',
  },
  target: {
    type: 'FACILITY' as const,
    id: 'fac-1',
    name: 'Main Campus',
    facilityName: 'Main Campus',
  },
};

function renderWithRole(role: 'USER' | 'MANAGER' | 'ADMIN') {
  vi.mocked(authApi.me).mockResolvedValue({
    id: 'current-user',
    name: 'Current User',
    email: 'current@example.com',
    role,
    isActive: true,
  });

  return render(
    <MemoryRouter>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('Manager workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(accessRequestApi.listPending).mockResolvedValue([pendingRequest]);
    window.confirm = vi.fn(() => true);
  });

  it('manager can see pending request UI', async () => {
    render(
      <MemoryRouter initialEntries={['/manager/requests']}>
        <AuthProvider>
          <ManagerRequestsPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    vi.mocked(authApi.me).mockResolvedValue({
      id: 'mgr-1',
      name: 'Manager',
      email: 'manager@example.com',
      role: 'MANAGER',
      isActive: true,
    });

    expect(await screen.findByText('Maintenance window')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
  });

  it('USER does not see manager actions in navigation', async () => {
    renderWithRole('USER');

    await waitFor(() => {
      expect(screen.getByText(/Current User/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole('link', { name: /pending approvals/i })).not.toBeInTheDocument();
  });

  it('approve action calls correct API', async () => {
    vi.mocked(accessRequestApi.approve).mockResolvedValue({ id: 'req-1', status: 'APPROVED' });

    render(
      <MemoryRouter initialEntries={['/manager/requests']}>
        <AuthProvider>
          <ManagerRequestsPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    const approveButton = await screen.findByRole('button', { name: /^approve$/i });
    await userEvent.setup().click(approveButton);

    await waitFor(() => {
      expect(accessRequestApi.approve).toHaveBeenCalledWith('req-1');
    });
  });

  it('reject requires reason', async () => {
    render(
      <MemoryRouter initialEntries={['/manager/requests']}>
        <AuthProvider>
          <ManagerRequestsPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await userEvent.setup().click(await screen.findByRole('button', { name: /reject/i }));
    await userEvent.setup().click(screen.getByRole('button', { name: /confirm reject/i }));

    expect(await screen.findByText('Rejection reason is required')).toBeInTheDocument();
  });

  it('rejection error is displayed', async () => {
    vi.mocked(accessRequestApi.reject).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          error: {
            code: 'CONFLICT',
            message: 'This request has already been processed.',
          },
        },
      },
    });

    render(
      <MemoryRouter initialEntries={['/manager/requests']}>
        <AuthProvider>
          <ManagerRequestsPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await userEvent.setup().click(await screen.findByRole('button', { name: /reject/i }));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/rejection reason/i), 'Not eligible');
    await user.click(screen.getByRole('button', { name: /confirm reject/i }));

    expect(await screen.findByText('This request has already been processed.')).toBeInTheDocument();
  });
});
