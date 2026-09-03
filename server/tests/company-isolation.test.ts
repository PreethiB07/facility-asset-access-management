import request from 'supertest';
import { AccessType } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../src/app';
import { GLOBEX_COMPANY_ID, LEGACY_COMPANY_ID } from '../src/constants/company.constants';
import {
  authHeader,
  cleanupTestResources,
  getGlobexTokenForRole,
  getTokenForRole,
  TEST_RESOURCE_PREFIX,
} from './helpers';

const VALID_START = '2030-01-01T09:00:00.000Z';
const VALID_END = '2030-01-31T17:00:00.000Z';
const REASON = `${TEST_RESOURCE_PREFIX} isolation test reason`;

interface CompanyResources {
  facilityId: string;
  areaId: string;
  assetId: string;
  requestId: string;
}

async function createCompanyResources(
  adminToken: string,
  userToken: string,
  label: string,
): Promise<CompanyResources> {
  const facilityRes = await request(app)
    .post('/api/facilities')
    .set(authHeader(adminToken))
    .send({
      name: `${TEST_RESOURCE_PREFIX} ${label} Facility`,
      requiresApproval: true,
    });
  expect(facilityRes.status).toBe(201);
  const facilityId = facilityRes.body.data.id as string;

  const areaRes = await request(app)
    .post(`/api/facilities/${facilityId}/areas`)
    .set(authHeader(adminToken))
    .send({
      name: `${TEST_RESOURCE_PREFIX} ${label} Area`,
      requiresApproval: true,
    });
  expect(areaRes.status).toBe(201);
  const areaId = areaRes.body.data.id as string;

  const assetRes = await request(app)
    .post('/api/assets')
    .set(authHeader(adminToken))
    .send({
      facilityId,
      areaId,
      name: `${TEST_RESOURCE_PREFIX} ${label} Asset`,
      requiresApproval: true,
    });
  expect(assetRes.status).toBe(201);
  const assetId = assetRes.body.data.id as string;

  const requestRes = await request(app)
    .post('/api/access-requests')
    .set(authHeader(userToken))
    .send({
      facilityId,
      accessType: AccessType.TEMPORARY,
      startAt: VALID_START,
      endAt: VALID_END,
      reason: `${REASON} ${label}`,
    });
  expect(requestRes.status).toBe(201);
  const requestId = requestRes.body.data.id as string;

  return { facilityId, areaId, assetId, requestId };
}

describe('Company isolation', () => {
  let acmeUserToken = '';
  let acmeManagerToken = '';
  let acmeAdminToken = '';
  let globexUserToken = '';
  let globexManagerToken = '';
  let globexAdminToken = '';
  let acme: CompanyResources;
  let globex: CompanyResources;

  beforeAll(async () => {
    acmeUserToken = await getTokenForRole('USER');
    acmeManagerToken = await getTokenForRole('MANAGER');
    acmeAdminToken = await getTokenForRole('ADMIN');
    globexUserToken = await getGlobexTokenForRole('USER');
    globexManagerToken = await getGlobexTokenForRole('MANAGER');
    globexAdminToken = await getGlobexTokenForRole('ADMIN');

    acme = await createCompanyResources(acmeAdminToken, acmeUserToken, 'Acme');
    globex = await createCompanyResources(globexAdminToken, globexUserToken, 'Globex');
  });

  afterAll(async () => {
    await cleanupTestResources();
  });

  describe('Company context', () => {
    it('returns companyId from authenticated user on /me', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set(authHeader(acmeUserToken));

      expect(response.status).toBe(200);
      expect(response.body.companyId).toBe(LEGACY_COMPANY_ID);
    });

    it('returns distinct companyId for Globex user', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set(authHeader(globexUserToken));

      expect(response.status).toBe(200);
      expect(response.body.companyId).toBe(GLOBEX_COMPANY_ID);
    });
  });

  describe('Facility isolation', () => {
    it('allows Company A user to read Company A facility', async () => {
      const response = await request(app)
        .get(`/api/facilities/${acme.facilityId}`)
        .set(authHeader(acmeUserToken));

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(acme.facilityId);
    });

    it('blocks Company A user from reading Company B facility', async () => {
      const response = await request(app)
        .get(`/api/facilities/${globex.facilityId}`)
        .set(authHeader(acmeUserToken));

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('lists only same-company facilities', async () => {
      const response = await request(app)
        .get('/api/facilities')
        .set(authHeader(acmeUserToken));

      expect(response.status).toBe(200);
      const ids = response.body.data.map((f: { id: string }) => f.id);
      expect(ids).toContain(acme.facilityId);
      expect(ids).not.toContain(globex.facilityId);
    });

    it('blocks Company A admin from updating Company B facility', async () => {
      const response = await request(app)
        .patch(`/api/facilities/${globex.facilityId}`)
        .set(authHeader(acmeAdminToken))
        .send({ name: `${TEST_RESOURCE_PREFIX} Hijacked` });

      expect(response.status).toBe(404);
    });
  });

  describe('Area isolation', () => {
    it('allows Company A user to read Company A area', async () => {
      const response = await request(app)
        .get(`/api/areas/${acme.areaId}`)
        .set(authHeader(acmeUserToken));

      expect(response.status).toBe(200);
    });

    it('blocks Company A user from reading Company B area', async () => {
      const response = await request(app)
        .get(`/api/areas/${globex.areaId}`)
        .set(authHeader(acmeUserToken));

      expect(response.status).toBe(404);
    });

    it('blocks Company A admin from creating area under Company B facility', async () => {
      const response = await request(app)
        .post(`/api/facilities/${globex.facilityId}/areas`)
        .set(authHeader(acmeAdminToken))
        .send({ name: `${TEST_RESOURCE_PREFIX} Cross Area` });

      expect(response.status).toBe(404);
    });

    it('blocks Company A admin from updating Company B area', async () => {
      const response = await request(app)
        .patch(`/api/areas/${globex.areaId}`)
        .set(authHeader(acmeAdminToken))
        .send({ name: `${TEST_RESOURCE_PREFIX} Hijacked Area` });

      expect(response.status).toBe(404);
    });
  });

  describe('Asset isolation', () => {
    it('allows Company A user to read Company A asset', async () => {
      const response = await request(app)
        .get(`/api/assets/${acme.assetId}`)
        .set(authHeader(acmeUserToken));

      expect(response.status).toBe(200);
    });

    it('blocks Company A user from reading Company B asset', async () => {
      const response = await request(app)
        .get(`/api/assets/${globex.assetId}`)
        .set(authHeader(acmeUserToken));

      expect(response.status).toBe(404);
    });

    it('blocks Company A admin from creating asset under Company B facility', async () => {
      const response = await request(app)
        .post('/api/assets')
        .set(authHeader(acmeAdminToken))
        .send({
          facilityId: globex.facilityId,
          name: `${TEST_RESOURCE_PREFIX} Cross Asset`,
        });

      expect(response.status).toBe(404);
    });

    it('blocks Company A admin from updating Company B asset', async () => {
      const response = await request(app)
        .patch(`/api/assets/${globex.assetId}`)
        .set(authHeader(acmeAdminToken))
        .send({ name: `${TEST_RESOURCE_PREFIX} Hijacked Asset` });

      expect(response.status).toBe(404);
    });
  });

  describe('Access request isolation', () => {
    it('allows Company A user to read own Company A request', async () => {
      const response = await request(app)
        .get(`/api/access-requests/${acme.requestId}`)
        .set(authHeader(acmeUserToken));

      expect(response.status).toBe(200);
    });

    it('blocks Company A user from reading Company B request', async () => {
      const response = await request(app)
        .get(`/api/access-requests/${globex.requestId}`)
        .set(authHeader(acmeUserToken));

      expect(response.status).toBe(404);
    });

    it('blocks Company A user from creating request against Company B facility', async () => {
      const response = await request(app)
        .post('/api/access-requests')
        .set(authHeader(acmeUserToken))
        .send({
          facilityId: globex.facilityId,
          accessType: AccessType.TEMPORARY,
          startAt: VALID_START,
          endAt: VALID_END,
          reason: REASON,
        });

      expect(response.status).toBe(404);
    });

    it('blocks Company A user from creating request against Company B area', async () => {
      const response = await request(app)
        .post('/api/access-requests')
        .set(authHeader(acmeUserToken))
        .send({
          areaId: globex.areaId,
          accessType: AccessType.TEMPORARY,
          startAt: VALID_START,
          endAt: VALID_END,
          reason: REASON,
        });

      expect(response.status).toBe(404);
    });

    it('blocks Company A user from creating request against Company B asset', async () => {
      const response = await request(app)
        .post('/api/access-requests')
        .set(authHeader(acmeUserToken))
        .send({
          assetId: globex.assetId,
          accessType: AccessType.TEMPORARY,
          startAt: VALID_START,
          endAt: VALID_END,
          reason: REASON,
        });

      expect(response.status).toBe(404);
    });
  });

  describe('Manager isolation', () => {
    it('lists only same-company pending requests', async () => {
      const response = await request(app)
        .get('/api/access-requests/pending')
        .set(authHeader(acmeManagerToken));

      expect(response.status).toBe(200);
      const ids = response.body.data.map((r: { id: string }) => r.id);
      expect(ids).toContain(acme.requestId);
      expect(ids).not.toContain(globex.requestId);
    });

    it('blocks Company A manager from approving Company B request', async () => {
      const response = await request(app)
        .post(`/api/access-requests/${globex.requestId}/approve`)
        .set(authHeader(acmeManagerToken));

      expect(response.status).toBe(404);
    });

    it('blocks Company A manager from rejecting Company B request', async () => {
      const response = await request(app)
        .post(`/api/access-requests/${globex.requestId}/reject`)
        .set(authHeader(acmeManagerToken))
        .send({ rejectionReason: `${TEST_RESOURCE_PREFIX} rejected cross-company` });

      expect(response.status).toBe(404);
    });
  });

  describe('Admin isolation', () => {
    it('blocks Company A admin from listing Company B facility areas', async () => {
      const response = await request(app)
        .get(`/api/facilities/${globex.facilityId}/areas`)
        .set(authHeader(acmeAdminToken));

      expect(response.status).toBe(404);
    });

    it('blocks Company A admin from listing Company B area assets', async () => {
      const response = await request(app)
        .get(`/api/areas/${globex.areaId}/assets`)
        .set(authHeader(acmeAdminToken));

      expect(response.status).toBe(404);
    });
  });

  describe('Company ID tampering', () => {
    it('ignores companyId in facility create body', async () => {
      const response = await request(app)
        .post('/api/facilities')
        .set(authHeader(acmeAdminToken))
        .send({
          name: `${TEST_RESOURCE_PREFIX} Tamper Facility`,
          companyId: GLOBEX_COMPANY_ID,
        });

      expect(response.status).toBe(201);
      const created = await request(app)
        .get(`/api/facilities/${response.body.data.id}`)
        .set(authHeader(acmeAdminToken));
      expect(created.status).toBe(200);

      const globexList = await request(app)
        .get('/api/facilities')
        .set(authHeader(globexAdminToken));
      const globexIds = globexList.body.data.map((f: { id: string }) => f.id);
      expect(globexIds).not.toContain(response.body.data.id);
    });

    it('ignores companyId in access request create body', async () => {
      const response = await request(app)
        .post('/api/access-requests')
        .set(authHeader(acmeUserToken))
        .send({
          facilityId: acme.facilityId,
          companyId: GLOBEX_COMPANY_ID,
          accessType: AccessType.TEMPORARY,
          startAt: VALID_START,
          endAt: VALID_END,
          reason: `${REASON} tamper`,
        });

      expect(response.status).toBe(201);

      const globexPending = await request(app)
        .get('/api/access-requests/pending')
        .set(authHeader(globexManagerToken));
      const globexIds = globexPending.body.data.map((r: { id: string }) => r.id);
      expect(globexIds).not.toContain(response.body.data.id);
    });
  });
});
