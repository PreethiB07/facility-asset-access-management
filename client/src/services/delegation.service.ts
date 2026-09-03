import api from './api';
import type { ApprovalDelegation, CreateDelegationPayload } from '../types';

export const delegationApi = {
  async list(): Promise<ApprovalDelegation[]> {
    const { data } = await api.get<{ data: ApprovalDelegation[] }>('/delegations');
    return data.data;
  },

  async create(payload: CreateDelegationPayload): Promise<ApprovalDelegation> {
    const { data } = await api.post<{ data: ApprovalDelegation }>('/delegations', payload);
    return data.data;
  },
};
