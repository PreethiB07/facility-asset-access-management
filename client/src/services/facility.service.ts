import api from './api';
import type { Facility, FacilityDetail } from '../types';

export const facilityApi = {
  async list(): Promise<Facility[]> {
    const { data } = await api.get<{ data: Facility[] }>('/facilities');
    return data.data;
  },

  async getById(id: string): Promise<FacilityDetail> {
    const { data } = await api.get<{ data: FacilityDetail }>(`/facilities/${id}`);
    return data.data;
  },
};
