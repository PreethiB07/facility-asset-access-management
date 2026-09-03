import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppLayout from '../components/layout/AppLayout';
import ManagerRequestsPage from '../pages/ManagerRequestsPage';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
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
  createdBy: {
    id: 'user-1',
    name: 'Jane User',
    email: 'jane@example.com',
  },
  requestedFor: {
    id: 'user-1',
    name: 'Jane User',
    email: 'jane@example.com',
  },
  canApprove: true,
  target: {
    type: 'FACILITY' as const,
    id: 'fac-1',
    name: 'Main Campus',
    facilityName: 'Main Campus',
  },
};

function renderManagerPage() {
  return render(
    <MemoryRouter initialEntries={['/manager/requests']}>
      <AuthProvider>
        <ToastProvider>
          <ManagerRequestsPage />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('Manager workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(accessRequestApi.listPending).mockResolvedValue([pendingRequest]);
  });

  it('manager can see pending request UI', async () => {
    renderManagerPage();

    expect(await screen.findByRole('heading', { name: /pending approvals/i })).toBeInTheDocument();
    expect(screen.getAllByText('Maintenance window').length).toBeGreaterThan(0);
    const table = screen.getByRole('table');
    expect(within(table).getByRole('button', { name: /approve/i })).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: /reject/i })).toBeInTheDocument();
  });

  it('USER does not see manager actions in navigation', async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      id: 'current-user',
      name: 'Current User',
      email: 'current@example.com',
      role: 'USER',
      isActive: true,
      companyId: '00000000-0000-4000-8000-000000000001',
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <AppLayout />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Current User/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole('link', { name: /pending approvals/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /administration/i })).not.toBeInTheDocument();
  });

  it('MANAGER sees pending approvals in navigation', async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      id: 'manager-user',
      name: 'Demo Manager',
      email: 'demo.manager@example.com',
      role: 'MANAGER',
      isActive: true,
      companyId: '00000000-0000-4000-8000-000000000001',
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <AppLayout />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Demo Manager/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /pending approvals/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /administration/i })).not.toBeInTheDocument();
  });

  it('ADMIN sees administration in navigation', async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      id: 'admin-user',
      name: 'Demo Admin',
      email: 'demo.admin@example.com',
      role: 'ADMIN',
      isActive: true,
      companyId: '00000000-0000-4000-8000-000000000001',
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <AppLayout />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Demo Admin/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /pending approvals/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /administration/i })).toBeInTheDocument();
  });

  it('approval confirmation is shown before approving', async () => {
    renderManagerPage();
    const table = await screen.findByRole('table');
    await userEvent.setup().click(within(table).getByRole('button', { name: /^approve$/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/approve this access request/i)).toBeInTheDocument();
  });

  it('approve action calls correct API', async () => {
    vi.mocked(accessRequestApi.approve).mockResolvedValue({ id: 'req-1', status: 'APPROVED' });

    renderManagerPage();
    const user = userEvent.setup();
    const table = await screen.findByRole('table');
    const approveButtons = within(table).getAllByRole('button', { name: /^approve$/i });
    await user.click(approveButtons[0]);
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^approve$/i }));

    await waitFor(() => {
      expect(accessRequestApi.approve).toHaveBeenCalledWith('req-1');
    });
  });

  it('reject requires reason', async () => {
    renderManagerPage();
    const table = await screen.findByRole('table');
    await userEvent.setup().click(within(table).getByRole('button', { name: /reject/i }));
    await userEvent.setup().click(screen.getByRole('button', { name: /reject request/i }));

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

    renderManagerPage();
    const user = userEvent.setup();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('button', { name: /reject/i }));
    await user.type(screen.getByLabelText(/^reason/i), 'Not eligible');
    await user.click(screen.getByRole('button', { name: /reject request/i }));

    expect(await screen.findByText('This request has already been processed.')).toBeInTheDocument();
  });

  it('successful approve updates UI with toast', async () => {
    vi.mocked(accessRequestApi.approve).mockResolvedValue({ id: 'req-1', status: 'APPROVED' });

    renderManagerPage();
    const user = userEvent.setup();
    const table = await screen.findByRole('table');
    const approveButtons = within(table).getAllByRole('button', { name: /^approve$/i });
    await user.click(approveButtons[0]);
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^approve$/i }));

    expect(await screen.findByText('Access request approved.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Maintenance window')).not.toBeInTheDocument();
    });
  });
});
