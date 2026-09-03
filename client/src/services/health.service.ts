import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

export interface HealthResponse {
  status: string;
}

export async function getHealthStatus(): Promise<HealthResponse> {
  const response = await api.get<HealthResponse>('/health');
  return response.data;
}
