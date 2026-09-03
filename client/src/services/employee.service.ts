import api from './api';
import type { EmployeeSummary } from '../types';

export const employeeApi = {
  async list(): Promise<EmployeeSummary[]> {
    const { data } = await api.get<{ data: EmployeeSummary[] }>('/employees');
    return data.data;
  },
};
