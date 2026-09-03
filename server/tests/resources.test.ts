import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import app from '../src/app';
import { prisma } from '../src/lib/prisma';
import {
  authHeader,
  cleanupTestResources,
  getTokenForRole,
  TEST_RESOURCE_PREFIX,
} from './helpers';

describe('Facility APIs', () => {
  let userToken = '';
  let adminToken = '';

  beforeAll(async () => {
    userToken = await getTokenForRole('USER');
    adminToken = await getTokenForRole('ADMIN');
  });

  afterEach(async () => {
    await cleanupTestResources();
  });

  it('allows authenticated user to list active facilities', async () => {
    const response = await request(app)
      .get('/api/facilities')
      .set(authHeader(userToken));

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.every((facility: { isActive: boolean }) => facility.isActive)).toBe(
      true,
    );
  });

  it('allows authenticated user to view facility details', async () => {
    const created = await request(app)
      .post('/api/facilities')
      .set(authHeader(adminToken))
      .send({
        name: `${TEST_RESOURCE_PREFIX} Main Office`,
        description: 'Corporate facility',
        requiresApproval: true,
      });

    const response = await request(app)
      .get(`/api/facilities/${created.body.data.id}`)
      .set(authHeader(userToken));

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      name: `${TEST_RESOURCE_PREFIX} Main Office`,
      isActive: true,
      requiresApproval: true,
    });
    expect(Array.isArray(response.body.data.areas)).toBe(true);
  });

  it('returns 404 for nonexistent facility', async () => {
    const response = await request(app)
      .get('/api/facilities/00000000-0000-0000-0000-000000000001')
      .set(authHeader(userToken));

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects unauthenticated facility list', async () => {
    const response = await request(app).get('/api/facilities');
    expect(response.status).toBe(401);
  });

  it('allows admin to create facility', async () => {
    const response = await request(app)
      .post('/api/facilities')
      .set(authHeader(adminToken))
      .send({
        name: `${TEST_RESOURCE_PREFIX} New Facility`,
        description: 'Created by admin',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.name).toBe(`${TEST_RESOURCE_PREFIX} New Facility`);
  });

  it('rejects normal user creating facility', async () => {
    const response = await request(app)
      .post('/api/facilities')
      .set(authHeader(userToken))
      .send({ name: `${TEST_RESOURCE_PREFIX} User Facility` });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('allows admin to update facility', async () => {
    const created = await request(app)
      .post('/api/facilities')
      .set(authHeader(adminToken))
      .send({ name: `${TEST_RESOURCE_PREFIX} Update Me` });

    const response = await request(app)
      .patch(`/api/facilities/${created.body.data.id}`)
      .set(authHeader(adminToken))
      .send({ isActive: false, description: 'Deactivated facility' });

    expect(response.status).toBe(200);
    expect(response.body.data.isActive).toBe(false);
    expect(response.body.data.description).toBe('Deactivated facility');
  });

  it('rejects invalid facility data', async () => {
    const response = await request(app)
      .post('/api/facilities')
      .set(authHeader(adminToken))
      .send({ name: '' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Area APIs', () => {
  let userToken = '';
  let adminToken = '';
  let facilityId = '';

  beforeAll(async () => {
    userToken = await getTokenForRole('USER');
    adminToken = await getTokenForRole('ADMIN');
  });

  afterEach(async () => {
    await cleanupTestResources();
  });

  async function createTestFacility(name: string): Promise<string> {
    const response = await request(app)
      .post('/api/facilities')
      .set(authHeader(adminToken))
      .send({ name: `${TEST_RESOURCE_PREFIX} ${name}` });
    return response.body.data.id as string;
  }

  it('allows user to list facility areas', async () => {
    facilityId = await createTestFacility('Area Parent');
    await request(app)
      .post(`/api/facilities/${facilityId}/areas`)
      .set(authHeader(adminToken))
      .send({ name: `${TEST_RESOURCE_PREFIX} Floor 1` });

    const response = await request(app)
      .get(`/api/facilities/${facilityId}/areas`)
      .set(authHeader(userToken));

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  it('allows user to view area', async () => {
    facilityId = await createTestFacility('Area View Parent');
    const created = await request(app)
      .post(`/api/facilities/${facilityId}/areas`)
      .set(authHeader(adminToken))
      .send({ name: `${TEST_RESOURCE_PREFIX} View Area` });

    const response = await request(app)
      .get(`/api/areas/${created.body.data.id}`)
      .set(authHeader(userToken));

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe(`${TEST_RESOURCE_PREFIX} View Area`);
  });

  it('returns 404 for nonexistent area', async () => {
    const response = await request(app)
      .get('/api/areas/00000000-0000-0000-0000-000000000002')
      .set(authHeader(userToken));

    expect(response.status).toBe(404);
  });

  it('does not expose area through mismatched facility route', async () => {
    const facilityA = await createTestFacility('Facility A');
    const facilityB = await createTestFacility('Facility B');

    const area = await request(app)
      .post(`/api/facilities/${facilityA}/areas`)
      .set(authHeader(adminToken))
      .send({ name: `${TEST_RESOURCE_PREFIX} Area A Only` });

    const listForB = await request(app)
      .get(`/api/facilities/${facilityB}/areas`)
      .set(authHeader(userToken));

    expect(listForB.body.data.some((item: { id: string }) => item.id === area.body.data.id)).toBe(
      false,
    );
  });

  it('allows admin to create area', async () => {
    facilityId = await createTestFacility('Area Create Parent');
    const response = await request(app)
      .post(`/api/facilities/${facilityId}/areas`)
      .set(authHeader(adminToken))
      .send({ name: `${TEST_RESOURCE_PREFIX} Admin Area` });

    expect(response.status).toBe(201);
    expect(response.body.data.facilityId).toBe(facilityId);
  });

  it('rejects area creation for invalid facility', async () => {
    const response = await request(app)
      .post('/api/facilities/00000000-0000-0000-0000-000000000003/areas')
      .set(authHeader(adminToken))
      .send({ name: `${TEST_RESOURCE_PREFIX} Orphan Area` });

    expect(response.status).toBe(404);
  });

  it('rejects normal user creating area', async () => {
    facilityId = await createTestFacility('Area Auth Parent');
    const response = await request(app)
      .post(`/api/facilities/${facilityId}/areas`)
      .set(authHeader(userToken))
      .send({ name: `${TEST_RESOURCE_PREFIX} User Area` });

    expect(response.status).toBe(403);
  });
});

describe('Asset APIs', () => {
  let userToken = '';
  let adminToken = '';

  beforeAll(async () => {
    userToken = await getTokenForRole('USER');
    adminToken = await getTokenForRole('ADMIN');
  });

  afterEach(async () => {
    await cleanupTestResources();
  });

  async function createFacilityAndArea(): Promise<{ facilityId: string; areaId: string }> {
    const facility = await request(app)
      .post('/api/facilities')
      .set(authHeader(adminToken))
      .send({ name: `${TEST_RESOURCE_PREFIX} Asset Facility` });

    const area = await request(app)
      .post(`/api/facilities/${facility.body.data.id}/areas`)
      .set(authHeader(adminToken))
      .send({ name: `${TEST_RESOURCE_PREFIX} Asset Area` });

    return {
      facilityId: facility.body.data.id as string,
      areaId: area.body.data.id as string,
    };
  }

  it('allows user to list assets', async () => {
    const response = await request(app).get('/api/assets').set(authHeader(userToken));
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('allows user to view asset', async () => {
    const { facilityId, areaId } = await createFacilityAndArea();
    const created = await request(app)
      .post('/api/assets')
      .set(authHeader(adminToken))
      .send({
        facilityId,
        areaId,
        name: `${TEST_RESOURCE_PREFIX} View Asset`,
      });

    const response = await request(app)
      .get(`/api/assets/${created.body.data.id}`)
      .set(authHeader(userToken));

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe(`${TEST_RESOURCE_PREFIX} View Asset`);
  });

  it('allows user to list assets within an area', async () => {
    const { facilityId, areaId } = await createFacilityAndArea();
    await request(app)
      .post('/api/assets')
      .set(authHeader(adminToken))
      .send({
        facilityId,
        areaId,
        name: `${TEST_RESOURCE_PREFIX} Area Asset`,
      });

    const response = await request(app)
      .get(`/api/areas/${areaId}/assets`)
      .set(authHeader(userToken));

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  it('supports asset without area', async () => {
    const facility = await request(app)
      .post('/api/facilities')
      .set(authHeader(adminToken))
      .send({ name: `${TEST_RESOURCE_PREFIX} Independent Facility` });

    const response = await request(app)
      .post('/api/assets')
      .set(authHeader(adminToken))
      .send({
        facilityId: facility.body.data.id,
        name: `${TEST_RESOURCE_PREFIX} Independent Asset`,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.areaId).toBeNull();
  });

  it('returns 404 for invalid asset', async () => {
    const response = await request(app)
      .get('/api/assets/00000000-0000-0000-0000-000000000004')
      .set(authHeader(userToken));

    expect(response.status).toBe(404);
  });

  it('rejects inconsistent facility and area relationship', async () => {
    const facilityA = await request(app)
      .post('/api/facilities')
      .set(authHeader(adminToken))
      .send({ name: `${TEST_RESOURCE_PREFIX} Asset Facility A` });

    const facilityB = await request(app)
      .post('/api/facilities')
      .set(authHeader(adminToken))
      .send({ name: `${TEST_RESOURCE_PREFIX} Asset Facility B` });

    const areaInA = await request(app)
      .post(`/api/facilities/${facilityA.body.data.id}/areas`)
      .set(authHeader(adminToken))
      .send({ name: `${TEST_RESOURCE_PREFIX} Asset Area A` });

    const response = await request(app)
      .post('/api/assets')
      .set(authHeader(adminToken))
      .send({
        facilityId: facilityB.body.data.id,
        areaId: areaInA.body.data.id,
        name: `${TEST_RESOURCE_PREFIX} Invalid Asset`,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toMatch(/does not belong/i);
  });

  it('allows admin to create asset', async () => {
    const { facilityId, areaId } = await createFacilityAndArea();
    const response = await request(app)
      .post('/api/assets')
      .set(authHeader(adminToken))
      .send({
        facilityId,
        areaId,
        name: `${TEST_RESOURCE_PREFIX} Admin Asset`,
      });

    expect(response.status).toBe(201);
  });

  it('rejects normal user creating asset', async () => {
    const { facilityId, areaId } = await createFacilityAndArea();
    const response = await request(app)
      .post('/api/assets')
      .set(authHeader(userToken))
      .send({
        facilityId,
        areaId,
        name: `${TEST_RESOURCE_PREFIX} User Asset`,
      });

    expect(response.status).toBe(403);
  });
});

describe('Resource authorization', () => {
  let userToken = '';
  let managerToken = '';
  let adminToken = '';

  beforeAll(async () => {
    userToken = await getTokenForRole('USER');
    managerToken = await getTokenForRole('MANAGER');
    adminToken = await getTokenForRole('ADMIN');
  });

  afterEach(async () => {
    await cleanupTestResources();
  });

  it('rejects USER on admin facility create', async () => {
    const response = await request(app)
      .post('/api/facilities')
      .set(authHeader(userToken))
      .send({ name: `${TEST_RESOURCE_PREFIX} Auth Facility` });

    expect(response.status).toBe(403);
  });

  it('rejects MANAGER on admin facility create', async () => {
    const response = await request(app)
      .post('/api/facilities')
      .set(authHeader(managerToken))
      .send({ name: `${TEST_RESOURCE_PREFIX} Manager Facility` });

    expect(response.status).toBe(403);
  });

  it('allows ADMIN on admin facility create', async () => {
    const response = await request(app)
      .post('/api/facilities')
      .set(authHeader(adminToken))
      .send({ name: `${TEST_RESOURCE_PREFIX} Admin Facility` });

    expect(response.status).toBe(201);
  });

  it('preserves deactivated facility without deleting access history', async () => {
    const facility = await request(app)
      .post('/api/facilities')
      .set(authHeader(adminToken))
      .send({ name: `${TEST_RESOURCE_PREFIX} Deactivate Facility` });

    await request(app)
      .patch(`/api/facilities/${facility.body.data.id}`)
      .set(authHeader(adminToken))
      .send({ isActive: false });

    const userView = await request(app)
      .get(`/api/facilities/${facility.body.data.id}`)
      .set(authHeader(userToken));

    expect(userView.status).toBe(404);

    const adminView = await request(app)
      .get(`/api/facilities/${facility.body.data.id}?active=false`)
      .set(authHeader(adminToken));

    expect(adminView.status).toBe(200);
    expect(adminView.body.data.isActive).toBe(false);

    const persisted = await prisma.facility.findUnique({
      where: { id: facility.body.data.id },
    });
    expect(persisted).not.toBeNull();
  });
});
