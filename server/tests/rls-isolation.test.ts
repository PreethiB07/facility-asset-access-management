import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import {
  GLOBEX_COMPANY_ID,
  LEGACY_COMPANY_ID,
} from '../src/constants/company.constants';
import { prisma } from '../src/lib/prisma';
import { getDb, runAsAppRole, runWithRawCompanyContext } from '../src/lib/prisma-tenant';
import { authHeader, bootstrapQuery, cleanupTestResources, getGlobexTokenForRole, getTokenForRole, TEST_RESOURCE_PREFIX } from './helpers';

const TEST_PREFIX = `${TEST_RESOURCE_PREFIX} rls`;

interface TenantFixtures {
  acmeFacilityId: string;
  globexFacilityId: string;
  acmeAreaId: string;
  globexAreaId: string;
  acmeAssetId: string;
  globexAssetId: string;
  acmeRequestId: string;
  globexRequestId: string;
  acmeUserId: string;
  globexUserId: string;
}

async function loadFixtures(): Promise<TenantFixtures> {
  return bootstrapQuery(async () => {
    const acmeFacility = await getDb().facility.findFirst({
      where: { companyId: LEGACY_COMPANY_ID, name: { contains: TEST_PREFIX } },
    });
    const globexFacility = await getDb().facility.findFirst({
      where: { companyId: GLOBEX_COMPANY_ID, name: { contains: TEST_PREFIX } },
    });

    if (!acmeFacility || !globexFacility) {
      throw new Error('RLS fixtures missing — beforeAll seed failed');
    }

    const acmeArea = await getDb().area.findFirst({ where: { facilityId: acmeFacility.id } });
    const globexArea = await getDb().area.findFirst({ where: { facilityId: globexFacility.id } });
    const acmeAsset = await getDb().asset.findFirst({ where: { facilityId: acmeFacility.id } });
    const globexAsset = await getDb().asset.findFirst({ where: { facilityId: globexFacility.id } });
    const acmeRequest = await getDb().accessRequest.findFirst({
      where: { companyId: LEGACY_COMPANY_ID, facilityId: acmeFacility.id },
    });
    const globexRequest = await getDb().accessRequest.findFirst({
      where: { companyId: GLOBEX_COMPANY_ID, facilityId: globexFacility.id },
    });
    const acmeUser = await getDb().user.findFirst({
      where: { companyId: LEGACY_COMPANY_ID, email: 'demo.user@example.com' },
    });
    const globexUser = await getDb().user.findFirst({
      where: { companyId: GLOBEX_COMPANY_ID, email: 'globex.user@example.com' },
    });

    if (
      !acmeArea ||
      !globexArea ||
      !acmeAsset ||
      !globexAsset ||
      !acmeRequest ||
      !globexRequest ||
      !acmeUser ||
      !globexUser
    ) {
      throw new Error('RLS fixtures incomplete');
    }

    return {
      acmeFacilityId: acmeFacility.id,
      globexFacilityId: globexFacility.id,
      acmeAreaId: acmeArea.id,
      globexAreaId: globexArea.id,
      acmeAssetId: acmeAsset.id,
      globexAssetId: globexAsset.id,
      acmeRequestId: acmeRequest.id,
      globexRequestId: globexRequest.id,
      acmeUserId: acmeUser.id,
      globexUserId: globexUser.id,
    };
  });
}

/** Unfiltered SQL read — relies on PostgreSQL RLS, not application WHERE companyId. */
async function sqlSelectFacilities(companyId: string | null): Promise<Array<{ id: string }>> {
  return runAsAppRole(async (tx) => {
    if (companyId) {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
    }
    return tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Facility"`;
  });
}

describe('PostgreSQL RLS isolation', () => {
  let fixtures: TenantFixtures;

  beforeAll(async () => {
    const acmeAdminToken = await getTokenForRole('ADMIN');
    const globexAdminToken = await getGlobexTokenForRole('ADMIN');
    const acmeUserToken = await getTokenForRole('USER');
    const globexUserToken = await getGlobexTokenForRole('USER');

    const acmeFacilityRes = await request(app)
      .post('/api/facilities')
      .set(authHeader(acmeAdminToken))
      .send({ name: `${TEST_PREFIX} Acme Facility`, requiresApproval: true });
    expect(acmeFacilityRes.status).toBe(201);

    const globexFacilityRes = await request(app)
      .post('/api/facilities')
      .set(authHeader(globexAdminToken))
      .send({ name: `${TEST_PREFIX} Globex Facility`, requiresApproval: true });
    expect(globexFacilityRes.status).toBe(201);

    const acmeFacilityId = acmeFacilityRes.body.data.id as string;
    const globexFacilityId = globexFacilityRes.body.data.id as string;

    const acmeAreaRes = await request(app)
      .post(`/api/facilities/${acmeFacilityId}/areas`)
      .set(authHeader(acmeAdminToken))
      .send({ name: `${TEST_PREFIX} Acme Area`, requiresApproval: true });

    const globexAreaRes = await request(app)
      .post(`/api/facilities/${globexFacilityId}/areas`)
      .set(authHeader(globexAdminToken))
      .send({ name: `${TEST_PREFIX} Globex Area`, requiresApproval: true });

    await request(app)
      .post('/api/assets')
      .set(authHeader(acmeAdminToken))
      .send({
        facilityId: acmeFacilityId,
        areaId: acmeAreaRes.body.data.id,
        name: `${TEST_PREFIX} Acme Asset`,
        requiresApproval: true,
      });

    await request(app)
      .post('/api/assets')
      .set(authHeader(globexAdminToken))
      .send({
        facilityId: globexFacilityId,
        areaId: globexAreaRes.body.data.id,
        name: `${TEST_PREFIX} Globex Asset`,
        requiresApproval: true,
      });

    await request(app)
      .post('/api/access-requests')
      .set(authHeader(acmeUserToken))
      .send({
        facilityId: acmeFacilityId,
        accessType: 'TEMPORARY',
        startAt: '2030-01-01T09:00:00.000Z',
        endAt: '2030-01-31T17:00:00.000Z',
        reason: `${TEST_PREFIX} Acme request`,
      });

    await request(app)
      .post('/api/access-requests')
      .set(authHeader(globexUserToken))
      .send({
        facilityId: globexFacilityId,
        accessType: 'TEMPORARY',
        startAt: '2030-01-01T09:00:00.000Z',
        endAt: '2030-01-31T17:00:00.000Z',
        reason: `${TEST_PREFIX} Globex request`,
      });

    fixtures = await loadFixtures();
  });

  afterAll(async () => {
    await bootstrapQuery(async () => {
      await getDb().accessRequest.deleteMany({ where: { reason: { startsWith: TEST_PREFIX } } });
      await getDb().asset.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
      await getDb().area.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
      await getDb().facility.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
    });
  });

  it('faam_app role does not have BYPASSRLS', async () => {
    const roles = await bootstrapQuery(() =>
      getDb().$queryRaw<Array<{ rolname: string; rolbypassrls: boolean }>>`
        SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'faam_app'
      `,
    );
    expect(roles).toHaveLength(1);
    expect(roles[0].rolbypassrls).toBe(false);
  });

  it('returns no tenant data when company context is missing (fail closed)', async () => {
    const rows = await sqlSelectFacilities(null);
    expect(rows).toHaveLength(0);
  });

  it('Company A context SELECT returns only Company A facilities (unfiltered SQL)', async () => {
    const rows = await sqlSelectFacilities(LEGACY_COMPANY_ID);
    const ids = rows.map((row) => row.id);
    expect(ids).toContain(fixtures.acmeFacilityId);
    expect(ids).not.toContain(fixtures.globexFacilityId);
  });

  it('Company B context SELECT returns only Company B facilities (unfiltered SQL)', async () => {
    const rows = await sqlSelectFacilities(GLOBEX_COMPANY_ID);
    const ids = rows.map((row) => row.id);
    expect(ids).toContain(fixtures.globexFacilityId);
    expect(ids).not.toContain(fixtures.acmeFacilityId);
  });

  it('Company A context cannot SELECT Company B facility by id', async () => {
    const rows = await runAsAppRole(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${LEGACY_COMPANY_ID}, true)`;
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Facility" WHERE id = ${fixtures.globexFacilityId}
      `;
    });
    expect(rows).toHaveLength(0);
  });

  it('blocks cross-company INSERT under Company A context', async () => {
    const newId = randomUUID();
    await expect(
      runAsAppRole(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_company_id', ${LEGACY_COMPANY_ID}, true)`;
        await tx.$executeRaw`
          INSERT INTO "Facility" ("id", "companyId", "name", "isActive", "requiresApproval", "createdAt", "updatedAt")
          VALUES (${newId}, ${GLOBEX_COMPANY_ID}, ${`${TEST_PREFIX} illegal`}, true, true, NOW(), NOW())
        `;
      }),
    ).rejects.toThrow();
  });

  it('allows same-company INSERT under Company A context', async () => {
    const newId = randomUUID();
    await runAsAppRole(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${LEGACY_COMPANY_ID}, true)`;
      await tx.$executeRaw`
        INSERT INTO "Facility" ("id", "companyId", "name", "isActive", "requiresApproval", "createdAt", "updatedAt")
        VALUES (${newId}, ${LEGACY_COMPANY_ID}, ${`${TEST_PREFIX} legal insert`}, true, true, NOW(), NOW())
      `;
    });

    const visible = await sqlSelectFacilities(LEGACY_COMPANY_ID);
    expect(visible.some((row) => row.id === newId)).toBe(true);
  });

  it('blocks cross-company UPDATE under Company A context', async () => {
    const updated = await runAsAppRole(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${LEGACY_COMPANY_ID}, true)`;
      return tx.$executeRaw`
        UPDATE "Facility" SET name = ${`${TEST_PREFIX} hijacked`}
        WHERE id = ${fixtures.globexFacilityId}
      `;
    });
    expect(Number(updated)).toBe(0);
  });

  it('allows same-company UPDATE under Company A context', async () => {
    const updatedName = `${TEST_PREFIX} updated acme`;
    await runAsAppRole(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${LEGACY_COMPANY_ID}, true)`;
      await tx.$executeRaw`
        UPDATE "Facility" SET name = ${updatedName}
        WHERE id = ${fixtures.acmeFacilityId}
      `;
    });

    const row = await runWithRawCompanyContext(LEGACY_COMPANY_ID, (tx) =>
      tx.$queryRaw<Array<{ name: string }>>`
        SELECT name FROM "Facility" WHERE id = ${fixtures.acmeFacilityId}
      `,
    );
    expect(row[0].name).toBe(updatedName);
  });

  it('blocks cross-company DELETE under Company A context', async () => {
    const deleted = await runAsAppRole(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${LEGACY_COMPANY_ID}, true)`;
      return tx.$executeRaw`DELETE FROM "Area" WHERE id = ${fixtures.globexAreaId}`;
    });
    expect(Number(deleted)).toBe(0);
  });

  it('blocks cross-company access to areas, assets, requests, and users', async () => {
    const areaRows = await runAsAppRole(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${LEGACY_COMPANY_ID}, true)`;
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Area" WHERE id = ${fixtures.globexAreaId}
      `;
    });
    expect(areaRows).toHaveLength(0);

    const assetRows = await runAsAppRole(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${LEGACY_COMPANY_ID}, true)`;
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Asset" WHERE id = ${fixtures.globexAssetId}
      `;
    });
    expect(assetRows).toHaveLength(0);

    const requestRows = await runAsAppRole(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${LEGACY_COMPANY_ID}, true)`;
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "AccessRequest" WHERE id = ${fixtures.globexRequestId}
      `;
    });
    expect(requestRows).toHaveLength(0);

    const userRows = await runAsAppRole(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${LEGACY_COMPANY_ID}, true)`;
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "User" WHERE id = ${fixtures.globexUserId}
      `;
    });
    expect(userRows).toHaveLength(0);
  });

  it('API chain: Company A JWT returns only Company A facilities via RLS-backed Prisma', async () => {
    const token = await getTokenForRole('USER');
    const response = await request(app).get('/api/facilities').set(authHeader(token));
    expect(response.status).toBe(200);
    const ids = response.body.data.map((f: { id: string }) => f.id);
    expect(ids).toContain(fixtures.acmeFacilityId);
    expect(ids).not.toContain(fixtures.globexFacilityId);
  });

  it('API chain: Company B JWT returns only Company B facilities via RLS-backed Prisma', async () => {
    const token = await getGlobexTokenForRole('USER');
    const response = await request(app).get('/api/facilities').set(authHeader(token));
    expect(response.status).toBe(200);
    const ids = response.body.data.map((f: { id: string }) => f.id);
    expect(ids).toContain(fixtures.globexFacilityId);
    expect(ids).not.toContain(fixtures.acmeFacilityId);
  });
});
