import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import app from '../src/app';
import { getDb } from '../src/lib/prisma-tenant';
import {
  authHeader,
  bootstrapQuery,
  cleanupTestResources,
  cleanupTestUsers,
  getGlobexTokenForRole,
  getTokenForRole,
  registerUser,
  TEST_RESOURCE_PREFIX,
  uniqueEmail,
} from './helpers';

const VALID_PASSWORD = 'Password123!';
const REASON = `${TEST_RESOURCE_PREFIX} Final requirement reason`;

function iso(date: string): string {
  return new Date(date).toISOString();
}

async function createFacility(adminToken: string, name: string): Promise<string> {
  const response = await request(app)
    .post('/api/facilities')
    .set(authHeader(adminToken))
    .send({ name: `${TEST_RESOURCE_PREFIX} ${name}`, requiresApproval: true });
  return response.body.data.id as string;
}

async function registerAndLogin(name: string, prefix: string) {
  const registered = await registerUser({
    name,
    email: uniqueEmail(prefix),
    password: VALID_PASSWORD,
  });
  return {
    token: registered.body.token as string,
    userId: registered.body.user.id as string,
  };
}

describe('Final requirement — on-behalf access requests', () => {
  let userToken = '';
  let userId = '';
  let managerToken = '';
  let managerId = '';
  let adminToken = '';

  beforeAll(async () => {
    const user = await registerAndLogin('Final Employee', 'final-employee');
    userToken = user.token;
    userId = user.userId;

    managerToken = await getTokenForRole('MANAGER');
    const managerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'demo.manager@example.com', password: 'DemoManager@123' });
    managerId = managerLogin.body.user.id as string;

    adminToken = await getTokenForRole('ADMIN');
  });

  afterEach(async () => {
    await cleanupTestResources();
  });

  afterAll(async () => {
    await cleanupTestUsers();
  });

  it('allows USER self request', async () => {
    const facilityId = await createFacility(adminToken, 'On Behalf Facility User');
    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        facilityId,
        accessType: 'PERMANENT',
        startAt: iso('2030-01-01T09:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.createdBy.id).toBe(userId);
    expect(response.body.data.requestedFor.id).toBe(userId);
  });

  it('allows MANAGER self request', async () => {
    const facilityId = await createFacility(adminToken, 'On Behalf Facility Manager');
    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(managerToken))
      .send({
        facilityId,
        accessType: 'PERMANENT',
        startAt: iso('2030-01-01T09:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.createdBy.id).toBe(managerId);
    expect(response.body.data.requestedFor.id).toBe(managerId);
  });

  it('allows MANAGER on-behalf request for same-company employee', async () => {
    const facilityId = await createFacility(adminToken, 'On Behalf Facility Employee');
    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(managerToken))
      .send({
        facilityId,
        requestedForId: userId,
        accessType: 'PERMANENT',
        startAt: iso('2030-01-01T09:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.createdBy.id).toBe(managerId);
    expect(response.body.data.requestedFor.id).toBe(userId);
  });

  it('rejects USER creating on-behalf request', async () => {
    const facilityId = await createFacility(adminToken, 'On Behalf Facility Reject User');
    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        facilityId,
        requestedForId: managerId,
        accessType: 'PERMANENT',
        startAt: iso('2030-01-01T09:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(403);
  });

  it('rejects cross-company employee beneficiary', async () => {
    const facilityId = await createFacility(adminToken, 'On Behalf Facility Cross Company');
    const globexUser = await request(app)
      .post('/api/auth/login')
      .send({ email: 'globex.user@example.com', password: 'GlobexUser@123' });

    const response = await request(app)
      .post('/api/access-requests')
      .set(authHeader(managerToken))
      .send({
        facilityId,
        requestedForId: globexUser.body.user.id,
        accessType: 'PERMANENT',
        startAt: iso('2030-01-01T09:00:00Z'),
        reason: REASON,
      });

    expect(response.status).toBe(404);
  });
});

describe('Final requirement — request visibility', () => {
  let employeeToken = '';
  let employeeId = '';
  let managerToken = '';
  let otherEmployeeToken = '';
  let adminToken = '';
  let requestId = '';

  beforeAll(async () => {
    const employee = await registerAndLogin('Visibility Employee', 'visibility-employee');
    employeeToken = employee.token;
    employeeId = employee.userId;

    const other = await registerAndLogin('Visibility Other', 'visibility-other');
    otherEmployeeToken = other.token;

    managerToken = await getTokenForRole('MANAGER');
    adminToken = await getTokenForRole('ADMIN');
  });

  afterEach(async () => {
    await cleanupTestResources();
    requestId = '';
  });

  afterAll(async () => {
    await cleanupTestUsers();
  });

  async function createOnBehalfRequest() {
    const facilityId = await createFacility(adminToken, 'Visibility Facility');
    const created = await request(app)
      .post('/api/access-requests')
      .set(authHeader(managerToken))
      .send({
        facilityId,
        requestedForId: employeeId,
        accessType: 'PERMANENT',
        startAt: iso('2030-01-01T09:00:00Z'),
        reason: REASON,
      });
    requestId = created.body.data.id as string;
    return created;
  }

  it('beneficiary and creator both see the request once', async () => {
    await createOnBehalfRequest();

    const beneficiaryList = await request(app)
      .get('/api/access-requests')
      .set(authHeader(employeeToken));
    expect(beneficiaryList.body.data.some((item: { id: string }) => item.id === requestId)).toBe(
      true,
    );

    const creatorList = await request(app)
      .get('/api/access-requests')
      .set(authHeader(managerToken));
    const matches = creatorList.body.data.filter((item: { id: string }) => item.id === requestId);
    expect(matches).toHaveLength(1);

    const otherList = await request(app)
      .get('/api/access-requests')
      .set(authHeader(otherEmployeeToken));
    expect(otherList.body.data.some((item: { id: string }) => item.id === requestId)).toBe(false);
  });

  it('other company cannot see the request', async () => {
    await createOnBehalfRequest();
    const globexToken = await getGlobexTokenForRole('USER');
    const response = await request(app)
      .get(`/api/access-requests/${requestId}`)
      .set(authHeader(globexToken));
    expect(response.status).toBe(404);
  });
});

describe('Final requirement — approved access beneficiary', () => {
  let employeeToken = '';
  let employeeId = '';
  let managerToken = '';
  let adminToken = '';
  let otherManagerToken = '';

  beforeAll(async () => {
    const employee = await registerAndLogin('Access Employee', 'access-employee');
    employeeToken = employee.token;
    employeeId = employee.userId;

    managerToken = await getTokenForRole('MANAGER');
    otherManagerToken = await getTokenForRole('ADMIN');
    adminToken = otherManagerToken;
  });

  afterEach(async () => {
    await cleanupTestResources();
  });

  afterAll(async () => {
    await cleanupTestUsers();
  });

  it('approved on-behalf access belongs to beneficiary not creator', async () => {
    const facilityId = await createFacility(adminToken, 'Beneficiary Facility');
    const created = await request(app)
      .post('/api/access-requests')
      .set(authHeader(managerToken))
      .send({
        facilityId,
        requestedForId: employeeId,
        accessType: 'PERMANENT',
        startAt: iso('2020-01-01T09:00:00Z'),
        reason: REASON,
      });

    const requestId = created.body.data.id as string;

    const approveResponse = await request(app)
      .patch(`/api/access-requests/${requestId}/approve`)
      .set(authHeader(otherManagerToken));

    expect(approveResponse.status).toBe(200);

    const employeeAccess = await request(app)
      .get('/api/my-access')
      .set(authHeader(employeeToken));
    expect(
      employeeAccess.body.data.some((item: { id: string }) => item.id === requestId),
    ).toBe(true);

    const managerAccess = await request(app)
      .get('/api/my-access')
      .set(authHeader(managerToken));
    expect(
      managerAccess.body.data.some((item: { id: string }) => item.id === requestId),
    ).toBe(false);
  });
});

describe('Final requirement — creator cannot approve or reject', () => {
  let managerToken = '';
  let adminToken = '';

  beforeAll(async () => {
    managerToken = await getTokenForRole('MANAGER');
    adminToken = await getTokenForRole('ADMIN');
  });

  afterEach(async () => {
    await cleanupTestResources();
  });

  it('rejects creator approving own request', async () => {
    const facilityId = await createFacility(adminToken, 'Creator Restriction Facility Approve');
    const created = await request(app)
      .post('/api/access-requests')
      .set(authHeader(managerToken))
      .send({
        facilityId,
        accessType: 'PERMANENT',
        startAt: iso('2030-01-01T09:00:00Z'),
        reason: REASON,
      });

    const requestId = created.body.data.id as string;
    const response = await request(app)
      .patch(`/api/access-requests/${requestId}/approve`)
      .set(authHeader(managerToken));

    expect(response.status).toBe(403);
  });

  it('rejects creator rejecting own request', async () => {
    const facilityId = await createFacility(adminToken, 'Creator Restriction Facility Reject');
    const created = await request(app)
      .post('/api/access-requests')
      .set(authHeader(managerToken))
      .send({
        facilityId,
        accessType: 'PERMANENT',
        startAt: iso('2030-01-01T09:00:00Z'),
        reason: REASON,
      });

    const requestId = created.body.data.id as string;
    const response = await request(app)
      .patch(`/api/access-requests/${requestId}/reject`)
      .set(authHeader(managerToken))
      .send({ rejectionReason: 'Should not work' });

    expect(response.status).toBe(403);
  });
});

describe('Final requirement — approval delegation', () => {
  let managerToken = '';
  let adminToken = '';
  let adminId = '';

  beforeAll(async () => {
    managerToken = await getTokenForRole('MANAGER');
    adminToken = await getTokenForRole('ADMIN');
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'demo.admin@example.com', password: 'DemoAdmin@123' });
    adminId = adminLogin.body.user.id as string;
  });

  afterEach(async () => {
    await bootstrapQuery(async () => {
      await getDb().approvalDelegation.deleteMany({
        where: { companyId: { not: '' } },
      });
    });
  });

  it('creates valid same-company delegation', async () => {
    const response = await request(app)
      .post('/api/delegations')
      .set(authHeader(managerToken))
      .send({
        delegatedManagerId: adminId,
        effectiveFrom: iso('2030-01-01T00:00:00Z'),
        effectiveUntil: iso('2030-01-31T23:59:59Z'),
      });

    expect(response.status).toBe(201);
    expect(response.body.data.delegatedManager.id).toBe(adminId);
  });

  it('rejects self-delegation', async () => {
    const managerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'demo.manager@example.com', password: 'DemoManager@123' });

    const response = await request(app)
      .post('/api/delegations')
      .set(authHeader(managerToken))
      .send({
        delegatedManagerId: managerLogin.body.user.id,
        effectiveFrom: iso('2030-01-01T00:00:00Z'),
        effectiveUntil: iso('2030-01-31T23:59:59Z'),
      });

    expect(response.status).toBe(400);
  });

  it('rejects invalid date range', async () => {
    const response = await request(app)
      .post('/api/delegations')
      .set(authHeader(managerToken))
      .send({
        delegatedManagerId: adminId,
        effectiveFrom: iso('2030-02-01T00:00:00Z'),
        effectiveUntil: iso('2030-01-01T00:00:00Z'),
      });

    expect(response.status).toBe(400);
  });

  it('rejects cross-company delegation', async () => {
    const globexManagerToken = await getGlobexTokenForRole('MANAGER');
    const response = await request(app)
      .post('/api/delegations')
      .set(authHeader(managerToken))
      .send({
        delegatedManagerId: (
          await request(app)
            .post('/api/auth/login')
            .send({ email: 'globex.manager@example.com', password: 'GlobexManager@123' })
        ).body.user.id,
        effectiveFrom: iso('2030-01-01T00:00:00Z'),
        effectiveUntil: iso('2030-01-31T23:59:59Z'),
      });

    expect(response.status).toBe(404);
    expect(globexManagerToken).toBeTruthy();
  });
});

describe('Final requirement — concurrent approval decisions', () => {
  let userToken = '';
  let managerToken = '';
  let adminToken = '';

  beforeAll(async () => {
    const user = await registerAndLogin('Concurrent Employee', 'concurrent-employee');
    userToken = user.token;
    managerToken = await getTokenForRole('MANAGER');
    adminToken = await getTokenForRole('ADMIN');
  });

  afterEach(async () => {
    await cleanupTestResources();
  });

  afterAll(async () => {
    await cleanupTestUsers();
  });

  async function createPendingRequest() {
    const facilityId = await createFacility(adminToken, 'Concurrent Facility');
    const created = await request(app)
      .post('/api/access-requests')
      .set(authHeader(userToken))
      .send({
        facilityId,
        accessType: 'PERMANENT',
        startAt: iso('2030-01-01T09:00:00Z'),
        reason: REASON,
      });
    return created.body.data.id as string;
  }

  it('approve vs reject results in exactly one final state and one history record', async () => {
    const requestId = await createPendingRequest();

    const [approveResult, rejectResult] = await Promise.all([
      request(app)
        .patch(`/api/access-requests/${requestId}/approve`)
        .set(authHeader(managerToken)),
      request(app)
        .patch(`/api/access-requests/${requestId}/reject`)
        .set(authHeader(adminToken))
        .send({ rejectionReason: 'Concurrent reject attempt' }),
    ]);

    const successes = [approveResult, rejectResult].filter((result) => result.status === 200);
    const conflicts = [approveResult, rejectResult].filter((result) => result.status === 409);
    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(1);

    const finalRequest = await bootstrapQuery(async () =>
      getDb().accessRequest.findFirst({ where: { id: requestId } }),
    );
    expect(finalRequest?.status === 'APPROVED' || finalRequest?.status === 'REJECTED').toBe(true);

    const history = await bootstrapQuery(async () =>
      getDb().approvalHistory.findMany({ where: { accessRequestId: requestId } }),
    );
    expect(history).toHaveLength(1);
  });

  it('approve vs approve creates access only once', async () => {
    const requestId = await createPendingRequest();

    const [first, second] = await Promise.all([
      request(app)
        .patch(`/api/access-requests/${requestId}/approve`)
        .set(authHeader(managerToken)),
      request(app)
        .patch(`/api/access-requests/${requestId}/approve`)
        .set(authHeader(adminToken)),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);

    const history = await bootstrapQuery(async () =>
      getDb().approvalHistory.findMany({ where: { accessRequestId: requestId } }),
    );
    expect(history).toHaveLength(1);
  });
});
