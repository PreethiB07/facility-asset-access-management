import request from 'supertest';
import { AccessType } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../src/app';
import {
  GLOBEX_COMPANY_ID,
  LEGACY_COMPANY_ID,
} from '../src/constants/company.constants';
import { getDb } from '../src/lib/prisma-tenant';
import {
  authHeader,
  bootstrapQuery,
  cleanupTestResources,
  getGlobexTokenForRole,
  getTokenForRole,
  TEST_RESOURCE_PREFIX,
} from './helpers';

const PREFIX = `${TEST_RESOURCE_PREFIX} regression`;
const FLOW_START = '2026-01-01T09:00:00.000Z';
const FLOW_END = '2030-12-31T17:00:00.000Z';
const FLOW_REASON = `${PREFIX} access flow reason`;

interface TenantContext {
  userToken: string;
  managerToken: string;
  adminToken: string;
  companyId: string;
  label: string;
  facilityId: string;
  areaId: string;
  assetId: string;
}

async function seedTenant(
  adminToken: string,
  userToken: string,
  label: string,
): Promise<Omit<TenantContext, 'userToken' | 'managerToken' | 'adminToken' | 'companyId'>> {
  const facilityRes = await request(app)
    .post('/api/facilities')
    .set(authHeader(adminToken))
    .send({ name: `${PREFIX} ${label} Facility`, requiresApproval: true });
  expect(facilityRes.status).toBe(201);

  const facilityId = facilityRes.body.data.id as string;

  const areaRes = await request(app)
    .post(`/api/facilities/${facilityId}/areas`)
    .set(authHeader(adminToken))
    .send({ name: `${PREFIX} ${label} Area`, requiresApproval: true });
  expect(areaRes.status).toBe(201);

  const areaId = areaRes.body.data.id as string;

  const assetRes = await request(app)
    .post('/api/assets')
    .set(authHeader(adminToken))
    .send({
      facilityId,
      areaId,
      name: `${PREFIX} ${label} Asset`,
      requiresApproval: true,
    });
  expect(assetRes.status).toBe(201);

  return { label, facilityId, areaId, assetId: assetRes.body.data.id as string };
}

describe('Multi-company regression (Stage 16)', () => {
  let acme: TenantContext;
  let globex: TenantContext;

  beforeAll(async () => {
    const acmeUserToken = await getTokenForRole('USER');
    const acmeManagerToken = await getTokenForRole('MANAGER');
    const acmeAdminToken = await getTokenForRole('ADMIN');
    const globexUserToken = await getGlobexTokenForRole('USER');
    const globexManagerToken = await getGlobexTokenForRole('MANAGER');
    const globexAdminToken = await getGlobexTokenForRole('ADMIN');

    const acmeSeed = await seedTenant(acmeAdminToken, acmeUserToken, 'Acme');
    const globexSeed = await seedTenant(globexAdminToken, globexUserToken, 'Globex');

    acme = {
      userToken: acmeUserToken,
      managerToken: acmeManagerToken,
      adminToken: acmeAdminToken,
      companyId: LEGACY_COMPANY_ID,
      ...acmeSeed,
    };

    globex = {
      userToken: globexUserToken,
      managerToken: globexManagerToken,
      adminToken: globexAdminToken,
      companyId: GLOBEX_COMPANY_ID,
      ...globexSeed,
    };
  });

  afterAll(async () => {
    await cleanupTestResources();
  });

  describe('Tenant data visibility (Company A / Company B users)', () => {
    it('Company A user sees only Company A facilities, areas, assets, and requests', async () => {
      const facilities = await request(app).get('/api/facilities').set(authHeader(acme.userToken));
      expect(facilities.status).toBe(200);
      const facilityIds = facilities.body.data.map((f: { id: string }) => f.id);
      expect(facilityIds).toContain(acme.facilityId);
      expect(facilityIds).not.toContain(globex.facilityId);

      const areas = await request(app)
        .get(`/api/facilities/${acme.facilityId}/areas`)
        .set(authHeader(acme.userToken));
      expect(areas.body.data.some((a: { id: string }) => a.id === acme.areaId)).toBe(true);

      const areaBlocked = await request(app)
        .get(`/api/facilities/${globex.facilityId}/areas`)
        .set(authHeader(acme.userToken));
      expect(areaBlocked.status).toBe(404);

      const assets = await request(app).get('/api/assets').set(authHeader(acme.userToken));
      const assetIds = assets.body.data.map((a: { id: string }) => a.id);
      expect(assetIds).toContain(acme.assetId);
      expect(assetIds).not.toContain(globex.assetId);

      const requests = await request(app)
        .get('/api/access-requests')
        .set(authHeader(acme.userToken));
      expect(requests.status).toBe(200);
      for (const item of requests.body.data) {
        expect(item.target.id).not.toBe(globex.facilityId);
        expect(item.target.id).not.toBe(globex.areaId);
        expect(item.target.id).not.toBe(globex.assetId);
      }
    });

    it('Company B user sees only Company B facilities, areas, assets, and requests', async () => {
      const facilities = await request(app)
        .get('/api/facilities')
        .set(authHeader(globex.userToken));
      const facilityIds = facilities.body.data.map((f: { id: string }) => f.id);
      expect(facilityIds).toContain(globex.facilityId);
      expect(facilityIds).not.toContain(acme.facilityId);

      const assets = await request(app).get('/api/assets').set(authHeader(globex.userToken));
      const assetIds = assets.body.data.map((a: { id: string }) => a.id);
      expect(assetIds).toContain(globex.assetId);
      expect(assetIds).not.toContain(acme.assetId);
    });
  });

  describe('Manager isolation (both directions)', () => {
    it('Company A manager approves Company A request and rejects Company B', async () => {
      const pending = await request(app)
        .post('/api/access-requests')
        .set(authHeader(acme.userToken))
        .send({
          facilityId: acme.facilityId,
          accessType: AccessType.TEMPORARY,
          startAt: FLOW_START,
          endAt: FLOW_END,
          reason: `${FLOW_REASON} acme pending`,
        });
      expect(pending.status).toBe(201);
      const acmeRequestId = pending.body.data.id as string;

      const approve = await request(app)
        .patch(`/api/access-requests/${acmeRequestId}/approve`)
        .set(authHeader(acme.managerToken));
      expect(approve.status).toBe(200);
      expect(approve.body.data.status).toBe('APPROVED');

      const globexPending = await request(app)
        .post('/api/access-requests')
        .set(authHeader(globex.userToken))
        .send({
          facilityId: globex.facilityId,
          accessType: AccessType.TEMPORARY,
          startAt: FLOW_START,
          endAt: FLOW_END,
          reason: `${FLOW_REASON} globex pending`,
        });
      const rejectCross = await request(app)
        .patch(`/api/access-requests/${globexPending.body.data.id}/approve`)
        .set(authHeader(acme.managerToken));
      expect(rejectCross.status).toBe(404);
    });

    it('Company B manager approves Company B request and cannot approve Company A', async () => {
      const pending = await request(app)
        .post('/api/access-requests')
        .set(authHeader(globex.userToken))
        .send({
          facilityId: globex.facilityId,
          accessType: AccessType.TEMPORARY,
          startAt: FLOW_START,
          endAt: FLOW_END,
          reason: `${FLOW_REASON} globex mgr`,
        });
      const globexRequestId = pending.body.data.id as string;

      const approve = await request(app)
        .patch(`/api/access-requests/${globexRequestId}/approve`)
        .set(authHeader(globex.managerToken));
      expect(approve.status).toBe(200);

      const acmePending = await request(app)
        .post('/api/access-requests')
        .set(authHeader(acme.userToken))
        .send({
          facilityId: acme.facilityId,
          accessType: AccessType.TEMPORARY,
          startAt: FLOW_START,
          endAt: FLOW_END,
          reason: `${FLOW_REASON} acme mgr block`,
        });

      const cross = await request(app)
        .patch(`/api/access-requests/${acmePending.body.data.id}/approve`)
        .set(authHeader(globex.managerToken));
      expect(cross.status).toBe(404);
    });
  });

  describe('Admin isolation', () => {
    it('Company A admin manages Company A resources only', async () => {
      const patch = await request(app)
        .patch(`/api/facilities/${acme.facilityId}`)
        .set(authHeader(acme.adminToken))
        .send({ description: `${PREFIX} acme admin update` });
      expect(patch.status).toBe(200);

      const blocked = await request(app)
        .patch(`/api/facilities/${globex.facilityId}`)
        .set(authHeader(acme.adminToken))
        .send({ description: `${PREFIX} should fail` });
      expect(blocked.status).toBe(404);

      const areaPatch = await request(app)
        .patch(`/api/areas/${acme.areaId}`)
        .set(authHeader(acme.adminToken))
        .send({ description: `${PREFIX} area ok` });
      expect(areaPatch.status).toBe(200);

      const areaBlocked = await request(app)
        .patch(`/api/areas/${globex.areaId}`)
        .set(authHeader(acme.adminToken))
        .send({ description: `${PREFIX} area fail` });
      expect(areaBlocked.status).toBe(404);
    });

    it('Company B admin manages Company B resources only', async () => {
      const patch = await request(app)
        .patch(`/api/assets/${globex.assetId}`)
        .set(authHeader(globex.adminToken))
        .send({ description: `${PREFIX} globex asset` });
      expect(patch.status).toBe(200);

      const blocked = await request(app)
        .patch(`/api/assets/${acme.assetId}`)
        .set(authHeader(globex.adminToken))
        .send({ description: `${PREFIX} asset fail` });
      expect(blocked.status).toBe(404);
    });
  });

  describe('End-to-end access request flow', () => {
    it('Company A: request → manager approve → current access', async () => {
      const facilityRes = await request(app)
        .post('/api/facilities')
        .set(authHeader(acme.adminToken))
        .send({
          name: `${PREFIX} Acme Flow Facility`,
          requiresApproval: true,
        });
      const facilityId = facilityRes.body.data.id as string;

      const create = await request(app)
        .post('/api/access-requests')
        .set(authHeader(acme.userToken))
        .send({
          facilityId,
          accessType: AccessType.TEMPORARY,
          startAt: FLOW_START,
          endAt: FLOW_END,
          reason: `${FLOW_REASON} acme e2e`,
        });
      expect(create.body.data.status).toBe('PENDING');

      const approve = await request(app)
        .patch(`/api/access-requests/${create.body.data.id}/approve`)
        .set(authHeader(acme.managerToken));
      expect(approve.status).toBe(200);

      const current = await request(app)
        .get('/api/my-access')
        .set(authHeader(acme.userToken));
      expect(current.status).toBe(200);
      expect(
        current.body.data.some((item: { target: { id: string } }) => item.target.id === facilityId),
      ).toBe(true);
    });

    it('Company B: request → manager approve → current access', async () => {
      const facilityRes = await request(app)
        .post('/api/facilities')
        .set(authHeader(globex.adminToken))
        .send({
          name: `${PREFIX} Globex Flow Facility`,
          requiresApproval: true,
        });
      const facilityId = facilityRes.body.data.id as string;

      const create = await request(app)
        .post('/api/access-requests')
        .set(authHeader(globex.userToken))
        .send({
          facilityId,
          accessType: AccessType.TEMPORARY,
          startAt: FLOW_START,
          endAt: FLOW_END,
          reason: `${FLOW_REASON} globex e2e`,
        });

      await request(app)
        .patch(`/api/access-requests/${create.body.data.id}/approve`)
        .set(authHeader(globex.managerToken));

      const current = await request(app)
        .get('/api/my-access')
        .set(authHeader(globex.userToken));
      expect(
        current.body.data.some((item: { target: { id: string } }) => item.target.id === facilityId),
      ).toBe(true);
    });
  });

  describe('Cross-company attack vectors', () => {
    it('blocks Company A JWT against all Company B resource IDs', async () => {
      const cases = [
        ['facility', `/api/facilities/${globex.facilityId}`],
        ['area', `/api/areas/${globex.areaId}`],
        ['asset', `/api/assets/${globex.assetId}`],
      ] as const;

      for (const [, path] of cases) {
        const res = await request(app).get(path).set(authHeader(acme.userToken));
        expect(res.status).toBe(404);
      }

      const createRes = await request(app)
        .post('/api/access-requests')
        .set(authHeader(acme.userToken))
        .send({
          facilityId: globex.facilityId,
          companyId: GLOBEX_COMPANY_ID,
          accessType: AccessType.TEMPORARY,
          startAt: FLOW_START,
          endAt: FLOW_END,
          reason: FLOW_REASON,
        });
      expect(createRes.status).toBe(404);
    });
  });
});

describe('Migration data integrity (Stage 16)', () => {
  it('all tenant records have non-null companyId', async () => {
    await bootstrapQuery(async () => {
      const counts = await getDb().$queryRaw<
        Array<{ table_name: string; null_count: bigint }>
      >`
        SELECT 'User' AS table_name, COUNT(*) AS null_count FROM "User" WHERE "companyId" IS NULL
        UNION ALL
        SELECT 'Facility', COUNT(*) FROM "Facility" WHERE "companyId" IS NULL
        UNION ALL
        SELECT 'Area', COUNT(*) FROM "Area" WHERE "companyId" IS NULL
        UNION ALL
        SELECT 'Asset', COUNT(*) FROM "Asset" WHERE "companyId" IS NULL
        UNION ALL
        SELECT 'AccessRequest', COUNT(*) FROM "AccessRequest" WHERE "companyId" IS NULL
      `;

      for (const row of counts) {
        expect(Number(row.null_count)).toBe(0);
      }
    });
  });

  it('legacy Acme company and demo users exist after migration', async () => {
    await bootstrapQuery(async () => {
      const acme = await getDb().company.findUnique({
        where: { id: LEGACY_COMPANY_ID },
      });
      expect(acme?.name).toBe('Acme Corporation');

      const demoUser = await getDb().user.findFirst({
        where: { companyId: LEGACY_COMPANY_ID, email: 'demo.user@example.com' },
      });
      expect(demoUser).not.toBeNull();

      const globex = await getDb().company.findUnique({
        where: { id: GLOBEX_COMPANY_ID },
      });
      expect(globex?.name).toBe('Globex Industries');
    });
  });
});
