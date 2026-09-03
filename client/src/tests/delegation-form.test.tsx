import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import DelegationPage from '../pages/DelegationPage';
import StrictManagerRoute from '../routes/StrictManagerRoute';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { authApi } from '../services/auth.service';
import { delegationApi } from '../services/delegation.service';
import { employeeApi } from '../services/employee.service';

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
    list: vi.fn().mockResolvedValue([]),
    getMyAccess: vi.fn().mockResolvedValue([]),
    listPending: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/facility.service', () => ({
  facilityApi: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/delegation.service', () => ({
  delegationApi: {
    list: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../services/employee.service', () => ({
  employeeApi: {
    list: vi.fn(),
  },
}));

const managerUser = {
  id: 'manager-1',
  name: 'Demo Manager',
  email: 'demo.manager@example.com',
  role: 'MANAGER' as const,
  isActive: true,
  companyId: '00000000-0000-4000-8000-000000000001',
};

const createdDelegation = {
  id: 'delegation-new',
  delegatingManager: {
    id: managerUser.id,
    name: managerUser.name,
    email: managerUser.email,
  },
  delegatedManager: {
    id: 'manager-2',
    name: 'Second Manager',
    email: 'manager2@example.com',
  },
  effectiveFrom: '2030-02-01T09:00:00.000Z',
  effectiveUntil: '2030-02-28T17:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderDelegationPage() {
  return render(
    <MemoryRouter initialEntries={['/manager/delegation']}>
      <AuthProvider>
        <ToastProvider>
          <DelegationPage />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('Delegation form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.me).mockResolvedValue(managerUser);
    vi.mocked(delegationApi.list).mockResolvedValue([]);
    vi.mocked(employeeApi.list).mockResolvedValue([
      {
        id: managerUser.id,
        name: managerUser.name,
        email: managerUser.email,
        role: 'MANAGER',
      },
      {
        id: 'manager-2',
        name: 'Second Manager',
        email: 'manager2@example.com',
        role: 'MANAGER',
      },
    ]);
  });

  it('valid delegation creation works', async () => {
    vi.mocked(delegationApi.create).mockResolvedValue(createdDelegation);
    renderDelegationPage();
    const user = userEvent.setup();

    await screen.findByRole('heading', { name: /approval delegation/i });
    await user.selectOptions(screen.getByLabelText(/delegate manager/i), 'manager-2');
    await user.type(screen.getByLabelText(/start date/i), '2030-02-01T09:00');
    await user.type(screen.getByLabelText(/end date/i), '2030-02-28T17:00');
    await user.click(screen.getByRole('button', { name: /create delegation/i }));

    await waitFor(() => {
      expect(delegationApi.create).toHaveBeenCalledWith({
        delegatedManagerId: 'manager-2',
        effectiveFrom: expect.any(String),
        effectiveUntil: expect.any(String),
      });
    });
    expect(await screen.findByText('Approval delegation created.')).toBeInTheDocument();
  });

  it('invalid delegation dates are rejected client-side', async () => {
    renderDelegationPage();
    const user = userEvent.setup();

    await screen.findByRole('heading', { name: /approval delegation/i });
    await user.selectOptions(screen.getByLabelText(/delegate manager/i), 'manager-2');
    await user.type(screen.getByLabelText(/start date/i), '2030-02-10T09:00');
    await user.type(screen.getByLabelText(/end date/i), '2030-02-01T09:00');
    await user.click(screen.getByRole('button', { name: /create delegation/i }));

    expect(await screen.findByText('End date must be after the start date')).toBeInTheDocument();
    expect(delegationApi.create).not.toHaveBeenCalled();
  });
});

describe('Delegation route guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(delegationApi.list).mockResolvedValue([]);
    vi.mocked(employeeApi.list).mockResolvedValue([]);
  });

  it('USER cannot access delegation route', async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      id: 'user-1',
      name: 'Demo User',
      email: 'demo.user@example.com',
      role: 'USER',
      isActive: true,
      companyId: managerUser.companyId,
    });

    render(
      <MemoryRouter initialEntries={['/manager/delegation']}>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /approval delegation/i })).not.toBeInTheDocument();
  });

  it('ADMIN cannot access delegation route', async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      id: 'admin-1',
      name: 'Demo Admin',
      email: 'demo.admin@example.com',
      role: 'ADMIN',
      isActive: true,
      companyId: managerUser.companyId,
    });

    render(
      <MemoryRouter initialEntries={['/manager/delegation']}>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route element={<StrictManagerRoute />}>
                <Route path="/manager/delegation" element={<DelegationPage />} />
              </Route>
              <Route path="/dashboard" element={<div>Dashboard page</div>} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /approval delegation/i })).not.toBeInTheDocument();
  });
});
