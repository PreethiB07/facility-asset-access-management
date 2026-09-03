import api from './api';
import type { AreaDetail } from '../types';
import type { Asset } from '../types';

export const areaApi = {
  async getById(id: string): Promise<AreaDetail> {
    const { data } = await api.get<{ data: AreaDetail }>(`/areas/${id}`);
    return data.data;
  },

  async listAssets(areaId: string): Promise<Asset[]> {
    const { data } = await api.get<{ data: Asset[] }>(`/areas/${areaId}/assets`);
    return data.data;
  },
};
