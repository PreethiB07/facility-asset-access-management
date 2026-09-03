import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app';
import {
  ACME_CORPORATION_NAME,
  GLOBEX_COMPANY_ID,
  LEGACY_COMPANY_ID,
} from '../src/constants/company.constants';
import { authHeader, getGlobexTokenForRole, getTokenForRole } from './helpers';

describe('Company details API', () => {
  it('USER can view own company details', async () => {
    const token = await getTokenForRole('USER');
    const response = await request(app).get('/api/company').set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(LEGACY_COMPANY_ID);
    expect(response.body.data.name).toBe(ACME_CORPORATION_NAME);
    expect(response.body.data.status).toBe('ACTIVE');
    expect(typeof response.body.data.totalUsers).toBe('number');
    expect(typeof response.body.data.totalFacilities).toBe('number');
    expect(response.body.data.createdAt).toBeTruthy();
  });

  it('MANAGER can view own company details', async () => {
    const token = await getTokenForRole('MANAGER');
    const response = await request(app).get('/api/company').set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(LEGACY_COMPANY_ID);
  });

  it('ADMIN can view own company details', async () => {
    const token = await getTokenForRole('ADMIN');
    const response = await request(app).get('/api/company').set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(LEGACY_COMPANY_ID);
  });

  it('rejects cross-company company details by ID', async () => {
    const token = await getTokenForRole('USER');
    const response = await request(app)
      .get(`/api/company/${GLOBEX_COMPANY_ID}`)
      .set(authHeader(token));

    expect(response.status).toBe(404);
  });

  it('allows own company details by ID', async () => {
    const token = await getTokenForRole('USER');
    const response = await request(app)
      .get(`/api/company/${LEGACY_COMPANY_ID}`)
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(LEGACY_COMPANY_ID);
  });

  it('Globex user cannot read Acme company by ID', async () => {
    const token = await getGlobexTokenForRole('USER');
    const response = await request(app)
      .get(`/api/company/${LEGACY_COMPANY_ID}`)
      .set(authHeader(token));

    expect(response.status).toBe(404);
  });
});
