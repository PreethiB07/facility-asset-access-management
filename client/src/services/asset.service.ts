import api from './api';
import type { Asset } from '../types';

export const assetApi = {
  async list(): Promise<Asset[]> {
    const { data } = await api.get<{ data: Asset[] }>('/assets');
    return data.data;
  },

  async getById(id: string): Promise<Asset> {
    const { data } = await api.get<{ data: Asset }>(`/assets/${id}`);
    return data.data;
  },
};
