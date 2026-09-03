import api from './api';
import type { Area, AreaDetail, Asset } from '../types';

export interface AreaPayload {
  name: string;
  description?: string | null;
  requiresApproval?: boolean;
  isActive?: boolean;
}

export const areaApi = {
  async getById(id: string): Promise<AreaDetail> {
    const { data } = await api.get<{ data: AreaDetail }>(`/areas/${id}`);
    return data.data;
  },

  async listByFacility(facilityId: string, active?: boolean): Promise<Area[]> {
    const params = active === undefined ? undefined : { active: String(active) };
    const { data } = await api.get<{ data: Area[] }>(`/facilities/${facilityId}/areas`, {
      params,
    });
    return data.data;
  },

  async listAssets(areaId: string): Promise<Asset[]> {
    const { data } = await api.get<{ data: Asset[] }>(`/areas/${areaId}/assets`);
    return data.data;
  },

  async create(facilityId: string, payload: AreaPayload): Promise<Area> {
    const { data } = await api.post<{ data: Area }>(`/facilities/${facilityId}/areas`, payload);
    return data.data;
  },

  async update(id: string, payload: Partial<AreaPayload>): Promise<AreaDetail> {
    const { data } = await api.patch<{ data: AreaDetail }>(`/areas/${id}`, payload);
    return data.data;
  },
};
