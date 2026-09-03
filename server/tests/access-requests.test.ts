import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src/app';
import { getDb } from '../src/lib/prisma-tenant';
import {
  authHeader,
  bootstrapQuery,
  cleanupTestResources,
  getTokenForRole,
  registerUser,
  TEST_RESOURCE_PREFIX,
  uniqueEmail,
} from './helpers';

const VALID_PASSWORD = 'Password123!';
const REASON = `${TEST_RESOURCE_PREFIX} Maintenance work`;

function iso(date: string): string {
  return new Date(date).toISOString();
}

async function createFacility(
  adminToken: string,
  name: string,
  requiresApproval = true,
): Promise<string> {
  const response = await request(app)
    .post('/api/facilities')
    .set(authHeader(adminToken))
    .send({ name: `${TEST_RESOURCE_PREFIX} ${name}`, requiresApproval });

  return response.body.data.id as string;
}

async function createArea(
  adminToken: string,
  facilityId: string,
  name: string,
  requiresApproval = true,
): Promise<string> {
  const response = await request(app)
    .post(`/api/facilities/${facilityId}/areas`)
    .set(authHeader(adminToken))
    .send({ name: `${TEST_RESOURCE_PREFIX} ${name}`, requiresApproval });

  return response.body.data.id as string;
}

async function createAsset(
  adminToken: string,
  facilityId: string,
  name: string,
  areaId?: string | null,
  requiresApproval = true,
): Promise<string> {
  const response = await request(app)
    .post('/api/assets')
    .set(authHeader(adminToken))
    .send({
      facilityId,
      areaId: areaId ?? undefined,
      name: `${TEST_RESOURCE_PREFIX} ${name}`,
      requiresApproval,
    });

  return response.body.data.id as string;
}

async function deactivate(adminToken: string, path: string): Promise<void> {
  await request(app).patch(path).set(authHeader(adminToken)).send({ isActive: false });
}

describe('Access request authentication', () => {
  afterEach(async () => {
    await cleanupTestResources();
  });

  it('rejects unauthenticated create request', async () => {
    const response = await request(app).post('/api/access-requests').send({
      facilityId: '00000000-0000-0000-0000-000000000010',
      accessType: 'TEMPORARY',
      startAt: iso('2026-09-03T10:00:00Z'),
      endAt: iso('2026-09-05T18:00:00Z'),
      reason: REASON,
    });

    expect(response.status).toBe(401);
  });

  it('rejects inactive user creating request', async () => {
    const adminToken = await getTokenForRole('ADMIN');
    const email = uniqueEmail('inactive-access');
    const registered = await registerUser({
      name: 'Inactive Access User',
      email,
      password: VALID_PASSWORD,
    });

    await bootstrapQuery(() =>
      getDb().user.update({
        where: { id: registered.body.user.id },
        data: { isActive: false },
      }),
    );

    const facilityId = await createFacility(adminToken, 'Inactive User Facility');
    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(registered.body.token))
      .send({
        facilityId,
        accessType: 'PERMANENT',
        startAt: iso('2026-09-03T10:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(403);
  });
});

describe('Access request target validation', () => {
  let userToken = '';
  let adminToken = '';
  let facilityId = '';
  let areaId = '';
  let assetId = '';
  let independentAssetId = '';

  beforeAll(async () => {
    userToken = await getTokenForRole('USER');
    adminToken = await getTokenForRole('ADMIN');
  });

  beforeEach(async () => {
    facilityId = await createFacility(adminToken, 'Target Facility', false);
    areaId = await createArea(adminToken, facilityId, 'Target Area', false);
    assetId = await createAsset(adminToken, facilityId, 'Target Asset', areaId, false);
    independentAssetId = await createAsset(adminToken, facilityId, 'Independent Asset', null, false);
  });

  afterEach(async () => {
    await cleanupTestResources();
  });

  it('creates facility request', async () => {
    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        facilityId,
        accessType: 'PERMANENT',
        startAt: iso('2026-09-03T10:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.target.type).toBe('FACILITY');
    expect(response.body.data.status).toBe('APPROVED');
  });

  it('creates area request', async () => {
    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        areaId,
        accessType: 'PERMANENT',
        startAt: iso('2026-09-03T10:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.target.type).toBe('AREA');
  });

  it('creates asset request', async () => {
    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        assetId,
        accessType: 'TEMPORARY',
        startAt: iso('2026-09-03T10:00:00Z'),
        endAt: iso('2026-09-05T18:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.target.type).toBe('ASSET');
  });

  it('creates independent asset request', async () => {
    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        assetId: independentAssetId,
        accessType: 'PERMANENT',
        startAt: iso('2026-09-03T10:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.target.areaId).toBeNull();
  });

  it('rejects request with no target', async () => {
    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        accessType: 'PERMANENT',
        startAt: iso('2026-09-03T10:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(400);
  });

  it('rejects request with multiple targets', async () => {
    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        facilityId,
        areaId,
        accessType: 'PERMANENT',
        startAt: iso('2026-09-03T10:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(400);
  });

  it('rejects nonexistent facility', async () => {
    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        facilityId: '11111111-1111-4111-8111-111111111111',
        accessType: 'PERMANENT',
        startAt: iso('2026-09-03T10:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(404);
  });

  it('rejects nonexistent area', async () => {
    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        areaId: '22222222-2222-4222-8222-222222222222',
        accessType: 'PERMANENT',
        startAt: iso('2026-09-03T10:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(404);
  });

  it('rejects nonexistent asset', async () => {
    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        assetId: '33333333-3333-4333-8333-333333333333',
        accessType: 'PERMANENT',
        startAt: iso('2026-09-03T10:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(404);
  });
});

describe('Access request inactive resources', () => {
  let userToken = '';
  let adminToken = '';

  beforeAll(async () => {
    userToken = await getTokenForRole('USER');
    adminToken = await getTokenForRole('ADMIN');
  });

  afterEach(async () => {
    await cleanupTestResources();
  });

  it('rejects inactive facility', async () => {
    const facilityId = await createFacility(adminToken, 'Inactive Facility');
    await deactivate(adminToken, `/api/facilities/${facilityId}`);

    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        facilityId,
        accessType: 'PERMANENT',
        startAt: iso('2026-09-03T10:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(400);
  });

  it('rejects inactive area', async () => {
    const facilityId = await createFacility(adminToken, 'Inactive Area Facility');
    const areaId = await createArea(adminToken, facilityId, 'Inactive Area');
    await deactivate(adminToken, `/api/areas/${areaId}`);

    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        areaId,
        accessType: 'PERMANENT',
        startAt: iso('2026-09-03T10:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(400);
  });

  it('rejects inactive asset', async () => {
    const facilityId = await createFacility(adminToken, 'Inactive Asset Facility');
    const assetId = await createAsset(adminToken, facilityId, 'Inactive Asset');
    await deactivate(adminToken, `/api/assets/${assetId}`);

    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        assetId,
        accessType: 'PERMANENT',
        startAt: iso('2026-09-03T10:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(400);
  });

  it('rejects asset under inactive facility', async () => {
    const facilityId = await createFacility(adminToken, 'Inactive Parent Facility');
    const assetId = await createAsset(adminToken, facilityId, 'Asset Under Inactive Facility');
    await deactivate(adminToken, `/api/facilities/${facilityId}`);

    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        assetId,
        accessType: 'PERMANENT',
        startAt: iso('2026-09-03T10:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(400);
  });

  it('rejects asset under inactive area', async () => {
    const facilityId = await createFacility(adminToken, 'Inactive Area Parent Facility');
    const areaId = await createArea(adminToken, facilityId, 'Inactive Parent Area');
    const assetId = await createAsset(adminToken, facilityId, 'Asset Under Inactive Area', areaId);
    await deactivate(adminToken, `/api/areas/${areaId}`);

    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        assetId,
        accessType: 'PERMANENT',
        startAt: iso('2026-09-03T10:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(400);
  });
});

describe('Access request access type validation', () => {
  let userToken = '';
  let adminToken = '';
  let facilityId = '';

  beforeAll(async () => {
    userToken = await getTokenForRole('USER');
    adminToken = await getTokenForRole('ADMIN');
  });

  beforeEach(async () => {
    facilityId = await createFacility(adminToken, 'Access Type Facility', false);
  });

  afterEach(async () => {
    await cleanupTestResources();
  });

  it('requires endAt for temporary request', async () => {
    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        facilityId,
        accessType: 'TEMPORARY',
        startAt: iso('2026-09-03T10:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(400);
  });

  it('accepts temporary request with valid dates', async () => {
    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        facilityId,
        accessType: 'TEMPORARY',
        startAt: iso('2026-09-03T10:00:00Z'),
        endAt: iso('2026-09-05T18:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(201);
  });

  it('rejects endAt before startAt', async () => {
    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        facilityId,
        accessType: 'TEMPORARY',
        startAt: iso('2026-09-05T18:00:00Z'),
        endAt: iso('2026-09-03T10:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(400);
  });

  it('rejects equal start and end dates', async () => {
    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        facilityId,
        accessType: 'TEMPORARY',
        startAt: iso('2026-09-03T10:00:00Z'),
        endAt: iso('2026-09-03T10:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(400);
  });

  it('accepts permanent request without endAt', async () => {
    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        facilityId,
        accessType: 'PERMANENT',
        startAt: iso('2026-09-03T10:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.endAt).toBeNull();
  });

  it('rejects permanent request with endAt', async () => {
    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        facilityId,
        accessType: 'PERMANENT',
        startAt: iso('2026-09-03T10:00:00Z'),
        endAt: iso('2026-09-05T18:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(400);
  });
});

describe('Access request reason validation', () => {
  let userToken = '';
  let adminToken = '';
  let facilityId = '';

  beforeAll(async () => {
    userToken = await getTokenForRole('USER');
    adminToken = await getTokenForRole('ADMIN');
  });

  beforeEach(async () => {
    facilityId = await createFacility(adminToken, 'Reason Facility', false);
  });

  afterEach(async () => {
    await cleanupTestResources();
  });

  it('accepts valid reason', async () => {
    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        facilityId,
        accessType: 'PERMANENT',
        startAt: iso('2026-09-03T10:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(201);
  });

  it('rejects missing reason', async () => {
    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        facilityId,
        accessType: 'PERMANENT',
        startAt: iso('2026-09-03T10:00:00Z'),
      });

    expect(response.status).toBe(400);
  });

  it('rejects empty reason', async () => {
    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        facilityId,
        accessType: 'PERMANENT',
        startAt: iso('2026-09-03T10:00:00Z'),
        reason: '',
      });

    expect(response.status).toBe(400);
  });

  it('rejects whitespace reason', async () => {
    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        facilityId,
        accessType: 'PERMANENT',
        startAt: iso('2026-09-03T10:00:00Z'),
        reason: '   ',
      });

    expect(response.status).toBe(400);
  });
});

describe('Access request approval logic', () => {
  let userToken = '';
  let adminToken = '';

  beforeAll(async () => {
    userToken = await getTokenForRole('USER');
    adminToken = await getTokenForRole('ADMIN');
  });

  afterEach(async () => {
    await cleanupTestResources();
  });

  it('auto-approves when approval is not required', async () => {
    const facilityId = await createFacility(adminToken, 'Auto Approve Facility', false);
    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        facilityId,
        accessType: 'PERMANENT',
        startAt: iso('2026-09-03T10:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('APPROVED');
    expect(response.body.data.approvedAt).not.toBeNull();
    expect(response.body.data.approvedById).toBeNull();
  });

  it('creates pending request when approval is required', async () => {
    const facilityId = await createFacility(adminToken, 'Pending Facility', true);
    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        facilityId,
        accessType: 'PERMANENT',
        startAt: iso('2026-09-03T10:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('PENDING');
    expect(response.body.data.approvedAt).toBeNull();
  });
});

describe('Access request ownership', () => {
  let userToken = '';
  let otherUserToken = '';
  let adminToken = '';

  beforeAll(async () => {
    adminToken = await getTokenForRole('ADMIN');

    const owner = await registerUser({
      name: 'Owner Access User',
      email: uniqueEmail('owner-access'),
      password: VALID_PASSWORD,
    });
    userToken = owner.body.token;

    const other = await registerUser({
      name: 'Other Access User',
      email: uniqueEmail('other-access'),
      password: VALID_PASSWORD,
    });
    otherUserToken = other.body.token;
  });

  afterEach(async () => {
    await cleanupTestResources();
  });

  it('lists only the authenticated user requests', async () => {
    const facilityId = await createFacility(adminToken, 'Ownership Facility', false);

    const created = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        facilityId,
        accessType: 'PERMANENT',
        startAt: iso('2026-09-03T10:00:00Z'),
        reason: REASON,
      });

    const response = await request(app)
      .get('/api/access-requests')
      .set(authHeader(userToken));

    expect(response.status).toBe(200);
    expect(response.body.data.some((item: { id: string }) => item.id === created.body.data.id)).toBe(
      true,
    );
  });

  it('returns 404 for another user private request', async () => {
    const facilityId = await createFacility(adminToken, 'Private Facility', false);
    const created = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        facilityId,
        accessType: 'PERMANENT',
        startAt: iso('2026-09-03T10:00:00Z'),
        reason: REASON,
      });

    const response = await request(app)
      .get(`/api/access-requests/${created.body.data.id}`)
      .set(authHeader(otherUserToken));

    expect(response.status).toBe(404);
  });
});

describe('Current access', () => {
  let userToken = '';
  let adminToken = '';

  beforeAll(async () => {
    adminToken = await getTokenForRole('ADMIN');
    const user = await registerUser({
      name: 'Current Access User',
      email: uniqueEmail('current-access'),
      password: VALID_PASSWORD,
    });
    userToken = user.body.token;
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-03T12:00:00Z'));
  });

  afterEach(async () => {
    vi.useRealTimers();
    await cleanupTestResources();
  });

  async function seedApprovedRequest(payload: Record<string, unknown>) {
    return request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send(payload);
  }

  it('includes approved permanent access', async () => {
    const facilityId = await createFacility(adminToken, 'Current Permanent Facility', false);
    await seedApprovedRequest({
      facilityId,
      accessType: 'PERMANENT',
      startAt: iso('2026-01-01T10:00:00Z'),
      reason: REASON,
    });

    const response = await request(app).get('/api/my-access').set(authHeader(userToken));
    expect(response.status).toBe(200);
    expect(response.body.data.some((item: { accessType: string }) => item.accessType === 'PERMANENT')).toBe(
      true,
    );
  });

  it('includes approved temporary access during valid period', async () => {
    const facilityId = await createFacility(adminToken, 'Current Temporary Facility', false);
    await seedApprovedRequest({
      facilityId,
      accessType: 'TEMPORARY',
      startAt: iso('2026-01-01T10:00:00Z'),
      endAt: iso('2026-01-05T18:00:00Z'),
      reason: REASON,
    });

    const response = await request(app).get('/api/my-access').set(authHeader(userToken));
    expect(response.body.data.some((item: { accessType: string }) => item.accessType === 'TEMPORARY')).toBe(
      true,
    );
  });

  it('excludes expired temporary access', async () => {
    const facilityId = await createFacility(adminToken, 'Expired Temporary Facility', false);
    await seedApprovedRequest({
      facilityId,
      accessType: 'TEMPORARY',
      startAt: iso('2025-12-01T10:00:00Z'),
      endAt: iso('2025-12-31T18:00:00Z'),
      reason: REASON,
    });

    const response = await request(app).get('/api/my-access').set(authHeader(userToken));
    expect(response.body.data).toHaveLength(0);
  });

  it('excludes future temporary access', async () => {
    const facilityId = await createFacility(adminToken, 'Future Temporary Facility', false);
    await seedApprovedRequest({
      facilityId,
      accessType: 'TEMPORARY',
      startAt: iso('2026-02-01T10:00:00Z'),
      endAt: iso('2026-02-05T18:00:00Z'),
      reason: REASON,
    });

    const response = await request(app).get('/api/my-access').set(authHeader(userToken));
    expect(response.body.data).toHaveLength(0);
  });

  it('excludes pending requests', async () => {
    const facilityId = await createFacility(adminToken, 'Pending Current Facility', true);
    await seedApprovedRequest({
      facilityId,
      accessType: 'PERMANENT',
      startAt: iso('2026-01-01T10:00:00Z'),
      reason: REASON,
    });

    const response = await request(app).get('/api/my-access').set(authHeader(userToken));
    expect(response.body.data).toHaveLength(0);
  });

  it('excludes rejected requests', async () => {
    const facilityId = await createFacility(adminToken, 'Rejected Current Facility', false);
    const created = await seedApprovedRequest({
      facilityId,
      accessType: 'PERMANENT',
      startAt: iso('2026-01-01T10:00:00Z'),
      reason: REASON,
    });

    await bootstrapQuery(() =>
      getDb().accessRequest.update({
        where: { id: created.body.data.id },
        data: { status: 'REJECTED' },
      }),
    );

    const response = await request(app).get('/api/my-access').set(authHeader(userToken));
    expect(response.body.data).toHaveLength(0);
  });

  it('excludes approved access when target becomes inactive', async () => {
    const facilityId = await createFacility(adminToken, 'Deactivate Current Facility', false);
    await seedApprovedRequest({
      facilityId,
      accessType: 'PERMANENT',
      startAt: iso('2026-01-01T10:00:00Z'),
      reason: REASON,
    });

    await deactivate(adminToken, `/api/facilities/${facilityId}`);

    const response = await request(app).get('/api/my-access').set(authHeader(userToken));
    expect(response.body.data).toHaveLength(0);

    const history = await request(app).get('/api/access-requests').set(authHeader(userToken));
    expect(history.body.data.some((item: { id: string }) => item.target.id === facilityId)).toBe(true);
  });
});
