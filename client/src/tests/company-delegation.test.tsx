import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppLayout from '../components/layout/AppLayout';
import CompanyDetailsPage from '../pages/CompanyDetailsPage';
import DelegationPage from '../pages/DelegationPage';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { authApi } from '../services/auth.service';
import { companyApi } from '../services/company.service';
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

vi.mock('../services/company.service', () => ({
  companyApi: {
    getMyCompany: vi.fn(),
  },
}));

const companyDetails = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Acme Corporation',
  status: 'ACTIVE' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  totalUsers: 3,
  totalFacilities: 3,
};

function renderCompanyPage() {
  return render(
    <MemoryRouter initialEntries={['/company']}>
      <AuthProvider>
        <ToastProvider>
          <CompanyDetailsPage />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('Company details UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(companyApi.getMyCompany).mockResolvedValue(companyDetails);
    vi.mocked(authApi.me).mockResolvedValue({
      id: 'user-1',
      name: 'Demo User',
      email: 'demo.user@example.com',
      role: 'USER',
      isActive: true,
      companyId: companyDetails.id,
    });
  });

  it('USER can view company details', async () => {
    renderCompanyPage();

    expect(await screen.findByRole('heading', { name: /company details/i })).toBeInTheDocument();
    expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    expect(screen.getByText(companyDetails.id)).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('Total users')).toBeInTheDocument();
    expect(screen.getByText('Total facilities')).toBeInTheDocument();
  });

  it('MANAGER can view company details', async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      id: 'manager-1',
      name: 'Demo Manager',
      email: 'demo.manager@example.com',
      role: 'MANAGER',
      isActive: true,
      companyId: companyDetails.id,
    });

    renderCompanyPage();
    expect(await screen.findByRole('heading', { name: /company details/i })).toBeInTheDocument();
  });

  it('ADMIN can view company details', async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      id: 'admin-1',
      name: 'Demo Admin',
      email: 'demo.admin@example.com',
      role: 'ADMIN',
      isActive: true,
      companyId: companyDetails.id,
    });

    renderCompanyPage();
    expect(await screen.findByRole('heading', { name: /company details/i })).toBeInTheDocument();
  });

  it('shows company details navigation for all roles', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <AppLayout />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /company details/i })).toBeInTheDocument();
    });
  });
});

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

const delegation = {
  id: 'delegation-1',
  delegatingManager: {
    id: 'manager-1',
    name: 'Demo Manager',
    email: 'demo.manager@example.com',
  },
  delegatedManager: {
    id: 'manager-2',
    name: 'Second Manager',
    email: 'manager2@example.com',
  },
  effectiveFrom: '2030-01-01T00:00:00.000Z',
  effectiveUntil: '2030-01-31T23:59:59.000Z',
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

describe('Delegation UI access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(delegationApi.list).mockResolvedValue([delegation]);
    vi.mocked(employeeApi.list).mockResolvedValue([
      {
        id: 'manager-1',
        name: 'Demo Manager',
        email: 'demo.manager@example.com',
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

  it('MANAGER sees delegation screen and current delegation', async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      id: 'manager-1',
      name: 'Demo Manager',
      email: 'demo.manager@example.com',
      role: 'MANAGER',
      isActive: true,
      companyId: companyDetails.id,
    });

    renderDelegationPage();

    expect(await screen.findByRole('heading', { name: /approval delegation/i })).toBeInTheDocument();
    expect(screen.getAllByText('Second Manager').length).toBeGreaterThan(0);
    expect(screen.getByRole('option', { name: /second manager/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /demo manager/i })).not.toBeInTheDocument();
  });

  it('MANAGER sees delegation navigation link', async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      id: 'manager-1',
      name: 'Demo Manager',
      email: 'demo.manager@example.com',
      role: 'MANAGER',
      isActive: true,
      companyId: companyDetails.id,
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <AppLayout />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /approval delegation/i })).toBeInTheDocument();
    });
  });

  it('USER does not see delegation navigation link', async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      id: 'user-1',
      name: 'Demo User',
      email: 'demo.user@example.com',
      role: 'USER',
      isActive: true,
      companyId: companyDetails.id,
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <AppLayout />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Demo User/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole('link', { name: /approval delegation/i })).not.toBeInTheDocument();
  });

  it('ADMIN does not see delegation navigation link', async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      id: 'admin-1',
      name: 'Demo Admin',
      email: 'demo.admin@example.com',
      role: 'ADMIN',
      isActive: true,
      companyId: companyDetails.id,
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

    expect(screen.queryByRole('link', { name: /approval delegation/i })).not.toBeInTheDocument();
  });
});
