import api from './api';
import type { Facility, FacilityDetail } from '../types';

export interface FacilityPayload {
  name: string;
  description?: string | null;
  requiresApproval?: boolean;
  isActive?: boolean;
}

export const facilityApi = {
  async list(active?: boolean): Promise<Facility[]> {
    const params = active === undefined ? undefined : { active: String(active) };
    const { data } = await api.get<{ data: Facility[] }>('/facilities', { params });
    return data.data;
  },

  async getById(id: string): Promise<FacilityDetail> {
    const { data } = await api.get<{ data: FacilityDetail }>(`/facilities/${id}`);
    return data.data;
  },

  async create(payload: FacilityPayload): Promise<Facility> {
    const { data } = await api.post<{ data: Facility }>('/facilities', payload);
    return data.data;
  },

  async update(id: string, payload: Partial<FacilityPayload>): Promise<Facility> {
    const { data } = await api.patch<{ data: Facility }>(`/facilities/${id}`, payload);
    return data.data;
  },
};
