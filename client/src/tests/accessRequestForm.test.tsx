import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AccessRequestForm from '../components/access/AccessRequestForm';
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

vi.mock('../services/accessRequest.service', () => ({
  accessRequestApi: {
    create: vi.fn(),
  },
}));

const mockUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'user@example.com',
};

const target = {
  type: 'ASSET' as const,
  assetId: 'asset-1',
  name: 'Server Rack A',
  facilityName: 'Main Campus',
};

function renderForm() {
  vi.mocked(authApi.me).mockResolvedValue({
    id: 'user-1',
    companyId: 'company-1',
    name: 'Test User',
    email: 'user@example.com',
    role: 'USER',
    isActive: true,
  });

  return render(
    <AuthProvider>
      <ToastProvider>
        <AccessRequestForm target={target} />
      </ToastProvider>
    </AuthProvider>,
  );
}

describe('Access request form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('request form renders', () => {
    renderForm();
    expect(screen.getByLabelText(/access type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/why is access needed/i)).toBeInTheDocument();
    expect(screen.getByText(/access target/i)).toBeInTheDocument();
  });

  it('temporary access requires end date', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(screen.getByLabelText(/access type/i), 'TEMPORARY');
    await user.type(screen.getByLabelText(/why is access needed/i), 'Need access for maintenance');
    await user.click(screen.getByRole('button', { name: /submit request/i }));

    expect(
      await screen.findByText('End date and time is required for temporary access'),
    ).toBeInTheDocument();
  });

  it('permanent access hides end date field', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(screen.getByLabelText(/access type/i), 'PERMANENT');

    expect(screen.queryByLabelText(/end date/i)).not.toBeInTheDocument();
  });

  it('invalid date range rejected', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(screen.getByLabelText(/access type/i), 'TEMPORARY');
    await user.type(screen.getByLabelText(/start date/i), '2030-06-01T10:00');
    await user.type(screen.getByLabelText(/end date/i), '2030-06-01T09:00');
    await user.type(screen.getByLabelText(/why is access needed/i), 'Maintenance');
    await user.click(screen.getByRole('button', { name: /submit request/i }));

    expect(await screen.findByText('End date must be after the start date')).toBeInTheDocument();
  });

  it('empty reason is rejected', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(screen.getByLabelText(/access type/i), 'PERMANENT');
    await user.click(screen.getByRole('button', { name: /submit request/i }));

    expect(await screen.findByText('Please provide a reason for this request')).toBeInTheDocument();
  });

  it('submission loading state', async () => {
    const user = userEvent.setup();
    vi.mocked(accessRequestApi.create).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                id: 'req-1',
                accessType: 'PERMANENT',
                startAt: new Date().toISOString(),
                endAt: null,
                reason: 'Project work',
                status: 'APPROVED',
                approvedAt: new Date().toISOString(),
                approvedById: null,
                rejectionReason: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: mockUser,
                requestedFor: mockUser,
                target: { type: 'ASSET', id: 'asset-1', name: 'Server Rack A' },
              }),
            100,
          );
        }),
    );

    renderForm();

    await user.selectOptions(screen.getByLabelText(/access type/i), 'PERMANENT');
    await user.type(screen.getByLabelText(/start date/i), '2030-01-01T09:00');
    await user.type(screen.getByLabelText(/why is access needed/i), 'Project work');
    await user.click(screen.getByRole('button', { name: /submit request/i }));

    expect(screen.getByRole('button', { name: /submitting/i })).toBeDisabled();
  });

  it('successful submission feedback for auto-approved access', async () => {
    const user = userEvent.setup();
    vi.mocked(accessRequestApi.create).mockResolvedValue({
      id: 'req-1',
      accessType: 'PERMANENT',
      startAt: new Date().toISOString(),
      endAt: null,
      reason: 'Project work',
      status: 'APPROVED',
      approvedAt: new Date().toISOString(),
      approvedById: null,
      rejectionReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: mockUser,
      requestedFor: mockUser,
      target: { type: 'ASSET', id: 'asset-1', name: 'Server Rack A' },
    });

    renderForm();

    await user.selectOptions(screen.getByLabelText(/access type/i), 'PERMANENT');
    await user.type(screen.getByLabelText(/start date/i), '2030-01-01T09:00');
    await user.type(screen.getByLabelText(/why is access needed/i), 'Project work');
    await user.click(screen.getByRole('button', { name: /submit request/i }));

    expect(await screen.findByText('Access has been approved.')).toBeInTheDocument();
  });

  it('API error is displayed', async () => {
    const user = userEvent.setup();
    vi.mocked(accessRequestApi.create).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 400,
        data: { error: { code: 'VALIDATION_ERROR', message: 'Target requires approval' } },
      },
    });

    renderForm();

    await user.selectOptions(screen.getByLabelText(/access type/i), 'PERMANENT');
    await user.type(screen.getByLabelText(/start date/i), '2030-01-01T09:00');
    await user.type(screen.getByLabelText(/why is access needed/i), 'Need access');
    await user.click(screen.getByRole('button', { name: /submit request/i }));

    expect(await screen.findByText('Target requires approval')).toBeInTheDocument();
  });

  it('permanent access does not send end date', async () => {
    const user = userEvent.setup();
    vi.mocked(accessRequestApi.create).mockResolvedValue({
      id: 'req-3',
      accessType: 'PERMANENT',
      startAt: new Date().toISOString(),
      endAt: null,
      reason: 'Long term',
      status: 'APPROVED',
      approvedAt: new Date().toISOString(),
      approvedById: null,
      rejectionReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: mockUser,
      requestedFor: mockUser,
      target: { type: 'ASSET', id: 'asset-1', name: 'Server Rack A' },
    });

    renderForm();

    await user.selectOptions(screen.getByLabelText(/access type/i), 'PERMANENT');
    await user.type(screen.getByLabelText(/start date/i), '2030-01-01T09:00');
    await user.type(screen.getByLabelText(/why is access needed/i), 'Long term');
    await user.click(screen.getByRole('button', { name: /submit request/i }));

    await waitFor(() => {
      expect(accessRequestApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          accessType: 'PERMANENT',
          assetId: 'asset-1',
        }),
      );
    });

    const payload = vi.mocked(accessRequestApi.create).mock.calls[0][0];
    expect(payload.endAt).toBeUndefined();
  });
});
