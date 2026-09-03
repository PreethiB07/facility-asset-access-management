import api from './api';
import type { Asset } from '../types';

export interface AssetPayload {
  facilityId: string;
  areaId?: string | null;
  name: string;
  description?: string | null;
  requiresApproval?: boolean;
  isActive?: boolean;
}

export const assetApi = {
  async list(active?: boolean): Promise<Asset[]> {
    const params = active === undefined ? undefined : { active: String(active) };
    const { data } = await api.get<{ data: Asset[] }>('/assets', { params });
    return data.data;
  },

  async getById(id: string): Promise<Asset> {
    const { data } = await api.get<{ data: Asset }>(`/assets/${id}`);
    return data.data;
  },

  async create(payload: AssetPayload): Promise<Asset> {
    const { data } = await api.post<{ data: Asset }>('/assets', payload);
    return data.data;
  },

  async update(id: string, payload: Partial<AssetPayload>): Promise<Asset> {
    const { data } = await api.patch<{ data: Asset }>(`/assets/${id}`, payload);
    return data.data;
  },
};
