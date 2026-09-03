import api from './api';
import type { CompanyDetails } from '../types';

export const companyApi = {
  async getMyCompany(): Promise<CompanyDetails> {
    const { data } = await api.get<{ data: CompanyDetails }>('/company');
    return data.data;
  },
};
