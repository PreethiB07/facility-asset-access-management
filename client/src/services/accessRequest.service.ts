import api from './api';
import type {
  AccessRequest,
  AccessRequestStatus,
  CreateAccessRequestPayload,
  CurrentAccess,
  PendingAccessRequest,
} from '../types';

export const accessRequestApi = {
  async create(payload: CreateAccessRequestPayload): Promise<AccessRequest> {
    const { data } = await api.post<{ data: AccessRequest }>('/access-requests', payload);
    return data.data;
  },

  async list(status?: AccessRequestStatus): Promise<AccessRequest[]> {
    const params = status ? { status } : undefined;
    const { data } = await api.get<{ data: AccessRequest[] }>('/access-requests', { params });
    return data.data;
  },

  async getById(id: string): Promise<AccessRequest> {
    const { data } = await api.get<{ data: AccessRequest }>(`/access-requests/${id}`);
    return data.data;
  },

  async getMyAccess(): Promise<CurrentAccess[]> {
    const { data } = await api.get<{ data: CurrentAccess[] }>('/my-access');
    return data.data;
  },

  async listPending(): Promise<PendingAccessRequest[]> {
    const { data } = await api.get<{ data: PendingAccessRequest[] }>('/access-requests/pending');
    return data.data;
  },

  async approve(id: string): Promise<{ id: string; status: string }> {
    const { data } = await api.patch<{ data: { id: string; status: string } }>(
      `/access-requests/${id}/approve`,
    );
    return data.data;
  },

  async reject(id: string, rejectionReason: string): Promise<{ id: string; status: string }> {
    const { data } = await api.patch<{ data: { id: string; status: string } }>(
      `/access-requests/${id}/reject`,
      { rejectionReason },
    );
    return data.data;
  },
};
