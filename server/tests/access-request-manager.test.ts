import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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
const REASON = `${TEST_RESOURCE_PREFIX} Manager workflow reason`;
const REJECTION_REASON = `${TEST_RESOURCE_PREFIX} Access is not required for this project.`;

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

async function createPendingFacilityRequest(
  userToken: string,
  facilityId: string,
  payload?: Record<string, unknown>,
) {
  return request(app)
    .post('/api/access-requests')
    .set(authHeader(userToken))
    .send({
      facilityId,
      accessType: 'PERMANENT',
      startAt: iso('2026-09-03T10:00:00Z'),
      reason: REASON,
      ...payload,
    });
}

describe('Pending access requests', () => {
  let userToken = '';
  let managerToken = '';
  let adminToken = '';

  beforeAll(async () => {
    const user = await registerUser({
      name: 'Pending User',
      email: uniqueEmail('pending-user'),
      password: VALID_PASSWORD,
    });
    userToken = user.body.token;
    managerToken = await getTokenForRole('MANAGER');
    adminToken = await getTokenForRole('ADMIN');
  });

  afterEach(async () => {
    await cleanupTestResources();
  });

  it('allows manager to view pending requests', async () => {
    const facilityId = await createFacility(adminToken, 'Pending Manager Facility');
    await createPendingFacilityRequest(userToken, facilityId);

    const response = await request(app)
      .get('/api/access-requests/pending')
      .set(authHeader(managerToken));

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data.every((item: { status: string }) => item.status === 'PENDING')).toBe(
      true,
    );
  });

  it('allows admin to view pending requests', async () => {
    const facilityId = await createFacility(adminToken, 'Pending Admin Facility');
    await createPendingFacilityRequest(userToken, facilityId);

    const response = await request(app)
      .get('/api/access-requests/pending')
      .set(authHeader(adminToken));

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  it('rejects normal user viewing pending requests', async () => {
    const response = await request(app)
      .get('/api/access-requests/pending')
      .set(authHeader(userToken));

    expect(response.status).toBe(403);
  });

  it('returns only pending requests', async () => {
    const facilityId = await createFacility(adminToken, 'Pending Only Facility', false);
    await createPendingFacilityRequest(userToken, facilityId);

    const response = await request(app)
      .get('/api/access-requests/pending')
      .set(authHeader(managerToken));

    expect(response.body.data.every((item: { status: string }) => item.status === 'PENDING')).toBe(
      true,
    );
  });

  it('includes requester information', async () => {
    const facilityId = await createFacility(adminToken, 'Pending Requester Facility');
    await createPendingFacilityRequest(userToken, facilityId);

    const response = await request(app)
      .get('/api/access-requests/pending')
      .set(authHeader(managerToken));

    const item = response.body.data.find(
      (entry: { target: { name: string } }) =>
        entry.target.name === `${TEST_RESOURCE_PREFIX} Pending Requester Facility`,
    );
    expect(item.requester).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      email: expect.any(String),
    });
    expect(item.requester).not.toHaveProperty('passwordHash');
  });

  it('includes target information', async () => {
    const facilityId = await createFacility(adminToken, 'Pending Target Facility');
    await createPendingFacilityRequest(userToken, facilityId);

    const response = await request(app)
      .get('/api/access-requests/pending')
      .set(authHeader(managerToken));

    const item = response.body.data.find(
      (entry: { reason: string }) => entry.reason === REASON,
    );
    expect(item.target.type).toBe('FACILITY');
    expect(item.target.name).toContain('Pending Target Facility');
  });
});

describe('Approve access requests', () => {
  let userToken = '';
  let managerToken = '';
  let adminToken = '';

  beforeAll(async () => {
    const user = await registerUser({
      name: 'Approve User',
      email: uniqueEmail('approve-user'),
      password: VALID_PASSWORD,
    });
    userToken = user.body.token;
    managerToken = await getTokenForRole('MANAGER');
    adminToken = await getTokenForRole('ADMIN');
  });

  afterEach(async () => {
    vi.useRealTimers();
    await cleanupTestResources();
  });

  async function pendingRequestId(facilityName: string): Promise<string> {
    const facilityId = await createFacility(adminToken, facilityName);
    const created = await createPendingFacilityRequest(userToken, facilityId);
    return created.body.data.id as string;
  }

  it('allows manager to approve pending request', async () => {
    const requestId = await pendingRequestId('Approve Manager Facility');
    const response = await request(app)
      .patch(`/api/access-requests/${requestId}/approve`)
      .set(authHeader(managerToken));

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('APPROVED');
  });

  it('allows admin to approve pending request', async () => {
    const requestId = await pendingRequestId('Approve Admin Facility');
    const response = await request(app)
      .patch(`/api/access-requests/${requestId}/approve`)
      .set(authHeader(adminToken));

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('APPROVED');
  });

  it('rejects user approving request', async () => {
    const requestId = await pendingRequestId('Approve User Forbidden Facility');
    const response = await request(app)
      .patch(`/api/access-requests/${requestId}/approve`)
      .set(authHeader(userToken));

    expect(response.status).toBe(403);
  });

  it('stores approved status', async () => {
    const requestId = await pendingRequestId('Approved Status Facility');
    await request(app)
      .patch(`/api/access-requests/${requestId}/approve`)
      .set(authHeader(managerToken));

    const stored = await bootstrapQuery(() =>
      getDb().accessRequest.findUnique({ where: { id: requestId } }),
    );
    expect(stored?.status).toBe('APPROVED');
  });

  it('records approver', async () => {
    const requestId = await pendingRequestId('Approver Facility');
    const response = await request(app)
      .patch(`/api/access-requests/${requestId}/approve`)
      .set(authHeader(managerToken));

    expect(response.body.data.approvedBy).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
    });
  });

  it('records approval timestamp', async () => {
    const requestId = await pendingRequestId('Approval Timestamp Facility');
    const response = await request(app)
      .patch(`/api/access-requests/${requestId}/approve`)
      .set(authHeader(managerToken));

    expect(response.body.data.approvedAt).not.toBeNull();
  });

  it('rejects approving already approved request', async () => {
    const requestId = await pendingRequestId('Already Approved Facility');
    await request(app)
      .patch(`/api/access-requests/${requestId}/approve`)
      .set(authHeader(managerToken));

    const response = await request(app)
      .patch(`/api/access-requests/${requestId}/approve`)
      .set(authHeader(managerToken));

    expect(response.status).toBe(409);
  });

  it('rejects approving rejected request', async () => {
    const requestId = await pendingRequestId('Approve Rejected Facility');
    await request(app)
      .patch(`/api/access-requests/${requestId}/reject`)
      .set(authHeader(managerToken))
      .send({ rejectionReason: REJECTION_REASON });

    const response = await request(app)
      .patch(`/api/access-requests/${requestId}/approve`)
      .set(authHeader(managerToken));

    expect(response.status).toBe(409);
  });

  it('returns 404 for nonexistent request', async () => {
    const response = await request(app)
      .patch('/api/access-requests/11111111-1111-4111-8111-111111111111/approve')
      .set(authHeader(managerToken));

    expect(response.status).toBe(404);
  });
});

describe('Reject access requests', () => {
  let userToken = '';
  let managerToken = '';
  let adminToken = '';

  beforeAll(async () => {
    const user = await registerUser({
      name: 'Reject User',
      email: uniqueEmail('reject-user'),
      password: VALID_PASSWORD,
    });
    userToken = user.body.token;
    managerToken = await getTokenForRole('MANAGER');
    adminToken = await getTokenForRole('ADMIN');
  });

  afterEach(async () => {
    await cleanupTestResources();
  });

  async function pendingRequestId(facilityName: string): Promise<string> {
    const facilityId = await createFacility(adminToken, facilityName);
    const created = await createPendingFacilityRequest(userToken, facilityId);
    return created.body.data.id as string;
  }

  it('allows manager to reject pending request', async () => {
    const requestId = await pendingRequestId('Reject Manager Facility');
    const response = await request(app)
      .patch(`/api/access-requests/${requestId}/reject`)
      .set(authHeader(managerToken))
      .send({ rejectionReason: REJECTION_REASON });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('REJECTED');
  });

  it('allows admin to reject pending request', async () => {
    const requestId = await pendingRequestId('Reject Admin Facility');
    const response = await request(app)
      .patch(`/api/access-requests/${requestId}/reject`)
      .set(authHeader(adminToken))
      .send({ rejectionReason: REJECTION_REASON });

    expect(response.status).toBe(200);
  });

  it('rejects user rejecting request', async () => {
    const requestId = await pendingRequestId('Reject User Forbidden Facility');
    const response = await request(app)
      .patch(`/api/access-requests/${requestId}/reject`)
      .set(authHeader(userToken))
      .send({ rejectionReason: REJECTION_REASON });

    expect(response.status).toBe(403);
  });

  it('requires rejection reason', async () => {
    const requestId = await pendingRequestId('Missing Reason Facility');
    const response = await request(app)
      .patch(`/api/access-requests/${requestId}/reject`)
      .set(authHeader(managerToken))
      .send({});

    expect(response.status).toBe(400);
  });

  it('rejects empty rejection reason', async () => {
    const requestId = await pendingRequestId('Empty Reason Facility');
    const response = await request(app)
      .patch(`/api/access-requests/${requestId}/reject`)
      .set(authHeader(managerToken))
      .send({ rejectionReason: '' });

    expect(response.status).toBe(400);
  });

  it('rejects whitespace rejection reason', async () => {
    const requestId = await pendingRequestId('Whitespace Reason Facility');
    const response = await request(app)
      .patch(`/api/access-requests/${requestId}/reject`)
      .set(authHeader(managerToken))
      .send({ rejectionReason: '   ' });

    expect(response.status).toBe(400);
  });

  it('stores rejected status', async () => {
    const requestId = await pendingRequestId('Rejected Status Facility');
    await request(app)
      .patch(`/api/access-requests/${requestId}/reject`)
      .set(authHeader(managerToken))
      .send({ rejectionReason: REJECTION_REASON });

    const stored = await bootstrapQuery(() =>
      getDb().accessRequest.findUnique({ where: { id: requestId } }),
    );
    expect(stored?.status).toBe('REJECTED');
    expect(stored?.rejectionReason).toBe(REJECTION_REASON);
  });

  it('records rejector as approver', async () => {
    const requestId = await pendingRequestId('Reject Approver Facility');
    const response = await request(app)
      .patch(`/api/access-requests/${requestId}/reject`)
      .set(authHeader(managerToken))
      .send({ rejectionReason: REJECTION_REASON });

    expect(response.body.data.approvedBy).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
    });
  });

  it('records rejection timestamp', async () => {
    const requestId = await pendingRequestId('Reject Timestamp Facility');
    const response = await request(app)
      .patch(`/api/access-requests/${requestId}/reject`)
      .set(authHeader(managerToken))
      .send({ rejectionReason: REJECTION_REASON });

    expect(response.body.data.approvedAt).not.toBeNull();
  });

  it('rejects rejecting already rejected request', async () => {
    const requestId = await pendingRequestId('Already Rejected Facility');
    await request(app)
      .patch(`/api/access-requests/${requestId}/reject`)
      .set(authHeader(managerToken))
      .send({ rejectionReason: REJECTION_REASON });

    const response = await request(app)
      .patch(`/api/access-requests/${requestId}/reject`)
      .set(authHeader(managerToken))
      .send({ rejectionReason: REJECTION_REASON });

    expect(response.status).toBe(409);
  });

  it('rejects rejecting approved request', async () => {
    const requestId = await pendingRequestId('Reject Approved Facility');
    await request(app)
      .patch(`/api/access-requests/${requestId}/approve`)
      .set(authHeader(managerToken));

    const response = await request(app)
      .patch(`/api/access-requests/${requestId}/reject`)
      .set(authHeader(managerToken))
      .send({ rejectionReason: REJECTION_REASON });

    expect(response.status).toBe(409);
  });
});

describe('Manager approval inactive resources', () => {
  let userToken = '';
  let managerToken = '';
  let adminToken = '';

  beforeAll(async () => {
    const user = await registerUser({
      name: 'Inactive Approval User',
      email: uniqueEmail('inactive-approval-user'),
      password: VALID_PASSWORD,
    });
    userToken = user.body.token;
    managerToken = await getTokenForRole('MANAGER');
    adminToken = await getTokenForRole('ADMIN');
  });

  afterEach(async () => {
    await cleanupTestResources();
  });

  it('rejects approving pending request for inactive facility', async () => {
    const facilityId = await createFacility(adminToken, 'Inactive Approve Facility');
    const created = await createPendingFacilityRequest(userToken, facilityId);
    await deactivate(adminToken, `/api/facilities/${facilityId}`);

    const response = await request(app)
      .patch(`/api/access-requests/${created.body.data.id}/approve`)
      .set(authHeader(managerToken));

    expect(response.status).toBe(400);
  });

  it('rejects approving pending request for inactive area', async () => {
    const facilityId = await createFacility(adminToken, 'Inactive Area Approve Facility');
    const areaId = await createArea(adminToken, facilityId, 'Inactive Approve Area');
    const created = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        areaId,
        accessType: 'PERMANENT',
        startAt: iso('2026-09-03T10:00:00Z'),
        reason: REASON,
      });
    await deactivate(adminToken, `/api/areas/${areaId}`);

    const response = await request(app)
      .patch(`/api/access-requests/${created.body.data.id}/approve`)
      .set(authHeader(managerToken));

    expect(response.status).toBe(400);
  });

  it('rejects approving pending request for inactive asset', async () => {
    const facilityId = await createFacility(adminToken, 'Inactive Asset Approve Facility');
    const assetId = await createAsset(adminToken, facilityId, 'Inactive Approve Asset');
    const created = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        assetId,
        accessType: 'PERMANENT',
        startAt: iso('2026-09-03T10:00:00Z'),
        reason: REASON,
      });
    await deactivate(adminToken, `/api/assets/${assetId}`);

    const response = await request(app)
      .patch(`/api/access-requests/${created.body.data.id}/approve`)
      .set(authHeader(managerToken));

    expect(response.status).toBe(400);
  });
});

describe('Manager approval expired temporary access', () => {
  let userToken = '';
  let managerToken = '';
  let adminToken = '';

  beforeAll(async () => {
    const user = await registerUser({
      name: 'Expired Approval User',
      email: uniqueEmail('expired-approval-user'),
      password: VALID_PASSWORD,
    });
    userToken = user.body.token;
    managerToken = await getTokenForRole('MANAGER');
    adminToken = await getTokenForRole('ADMIN');
  });

  afterEach(async () => {
    vi.useRealTimers();
    await cleanupTestResources();
  });

  it('rejects approving expired temporary request', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));

    const facilityId = await createFacility(adminToken, 'Expired Temporary Facility');
    const created = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        facilityId,
        accessType: 'TEMPORARY',
        startAt: iso('2026-01-01T10:00:00Z'),
        endAt: iso('2026-03-01T18:00:00Z'),
        reason: REASON,
      });

    const response = await request(app)
      .patch(`/api/access-requests/${created.body.data.id}/approve`)
      .set(authHeader(managerToken));

    expect(response.status).toBe(400);
  });
});

describe('Manager approval concurrency', () => {
  let userToken = '';
  let managerToken = '';
  let adminToken = '';

  beforeAll(async () => {
    const user = await registerUser({
      name: 'Concurrency User',
      email: uniqueEmail('concurrency-user'),
      password: VALID_PASSWORD,
    });
    userToken = user.body.token;
    managerToken = await getTokenForRole('MANAGER');
    adminToken = await getTokenForRole('ADMIN');
  });

  afterEach(async () => {
    await cleanupTestResources();
  });

  it('allows only one manager action to succeed on the same pending request', async () => {
    const facilityId = await createFacility(adminToken, 'Concurrency Facility');
    const created = await createPendingFacilityRequest(userToken, facilityId);
    const requestId = created.body.data.id as string;

    const [approveResult, rejectResult] = await Promise.all([
      request(app)
        .patch(`/api/access-requests/${requestId}/approve`)
        .set(authHeader(managerToken)),
      request(app)
        .patch(`/api/access-requests/${requestId}/reject`)
        .set(authHeader(managerToken))
        .send({ rejectionReason: REJECTION_REASON }),
    ]);

    const statuses = [approveResult.status, rejectResult.status].sort();
    expect(statuses).toEqual([200, 409]);
  });
});
