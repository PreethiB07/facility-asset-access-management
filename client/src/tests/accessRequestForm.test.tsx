import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AccessRequestForm from '../components/access/AccessRequestForm';
import { accessRequestApi } from '../services/accessRequest.service';

vi.mock('../services/accessRequest.service', () => ({
  accessRequestApi: {
    create: vi.fn(),
  },
}));

const target = {
  type: 'ASSET' as const,
  assetId: 'asset-1',
  name: 'Server Rack A',
};

describe('Access request form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('request form renders', () => {
    render(<AccessRequestForm target={target} />);
    expect(screen.getByLabelText(/access type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/reason/i)).toBeInTheDocument();
  });

  it('temporary access requires end date', async () => {
    const user = userEvent.setup();
    render(<AccessRequestForm target={target} />);

    await user.selectOptions(screen.getByLabelText(/access type/i), 'TEMPORARY');
    await user.type(screen.getByLabelText(/reason/i), 'Need access for maintenance');
    await user.click(screen.getByRole('button', { name: /submit request/i }));

    expect(
      await screen.findByText('End date and time is required for temporary access'),
    ).toBeInTheDocument();
  });

  it('permanent access hides end date field', async () => {
    const user = userEvent.setup();
    render(<AccessRequestForm target={target} />);

    await user.selectOptions(screen.getByLabelText(/access type/i), 'PERMANENT');

    expect(screen.queryByLabelText(/end date/i)).not.toBeInTheDocument();
  });

  it('empty reason is rejected', async () => {
    const user = userEvent.setup();
    render(<AccessRequestForm target={target} />);

    await user.selectOptions(screen.getByLabelText(/access type/i), 'PERMANENT');
    await user.click(screen.getByRole('button', { name: /submit request/i }));

    expect(await screen.findByText('Reason is required')).toBeInTheDocument();
  });

  it('successful request displays correct result for auto-approved access', async () => {
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
      target: {
        type: 'ASSET',
        id: 'asset-1',
        name: 'Server Rack A',
      },
    });

    render(<AccessRequestForm target={target} />);

    await user.selectOptions(screen.getByLabelText(/access type/i), 'PERMANENT');
    await user.type(screen.getByLabelText(/start date/i), '2030-01-01T09:00');
    await user.type(screen.getByLabelText(/reason/i), 'Project work');
    await user.click(screen.getByRole('button', { name: /submit request/i }));

    expect(await screen.findByText('Access approved')).toBeInTheDocument();
  });

  it('successful request displays pending message', async () => {
    const user = userEvent.setup();
    vi.mocked(accessRequestApi.create).mockResolvedValue({
      id: 'req-2',
      accessType: 'PERMANENT',
      startAt: new Date().toISOString(),
      endAt: null,
      reason: 'Need approval',
      status: 'PENDING',
      approvedAt: null,
      approvedById: null,
      rejectionReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      target: {
        type: 'ASSET',
        id: 'asset-1',
        name: 'Server Rack A',
      },
    });

    render(<AccessRequestForm target={target} />);

    await user.selectOptions(screen.getByLabelText(/access type/i), 'PERMANENT');
    await user.type(screen.getByLabelText(/start date/i), '2030-01-01T09:00');
    await user.type(screen.getByLabelText(/reason/i), 'Need approval');
    await user.click(screen.getByRole('button', { name: /submit request/i }));

    expect(await screen.findByText('Access request submitted for approval')).toBeInTheDocument();
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

    render(<AccessRequestForm target={target} />);

    await user.selectOptions(screen.getByLabelText(/access type/i), 'PERMANENT');
    await user.type(screen.getByLabelText(/start date/i), '2030-01-01T09:00');
    await user.type(screen.getByLabelText(/reason/i), 'Need access');
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
      target: { type: 'ASSET', id: 'asset-1', name: 'Server Rack A' },
    });

    render(<AccessRequestForm target={target} />);

    await user.selectOptions(screen.getByLabelText(/access type/i), 'PERMANENT');
    await user.type(screen.getByLabelText(/start date/i), '2030-01-01T09:00');
    await user.type(screen.getByLabelText(/reason/i), 'Long term');
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
