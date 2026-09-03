import request from 'supertest';
import { Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import app from '../src/app';
import { LEGACY_COMPANY_ID } from '../src/constants/company.constants';
import { getDb } from '../src/lib/prisma-tenant';
import { upsertUserByCompanyEmail } from '../src/utils/user-repository';
import {
  authHeader,
  bootstrapQuery,
  getTokenForRole,
  uniqueEmail,
} from './helpers';

const iso = (value: string) => value;

describe('Delegation access and UI rules', () => {
  let managerToken = '';
  let adminToken = '';
  let userToken = '';
  let secondManagerId = '';

  beforeAll(async () => {
    managerToken = await getTokenForRole('MANAGER');
    adminToken = await getTokenForRole('ADMIN');
    userToken = await getTokenForRole('USER');

    secondManagerId = await bootstrapQuery(async () => {
      const passwordHash = await bcrypt.hash('TestManager@123', 12);
      const user = await upsertUserByCompanyEmail({
        companyId: LEGACY_COMPANY_ID,
        email: uniqueEmail('acme-manager-2'),
        name: 'Second Acme Manager',
        passwordHash,
        role: Role.MANAGER,
        isActive: true,
      });
      return user.id;
    });
  });

  afterEach(async () => {
    await bootstrapQuery(async () => {
      await getDb().approvalDelegation.deleteMany({
        where: { companyId: LEGACY_COMPANY_ID },
      });
    });
  });

  it('MANAGER can list delegations', async () => {
    const response = await request(app).get('/api/delegations').set(authHeader(managerToken));
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('USER cannot access delegation API', async () => {
    const response = await request(app).get('/api/delegations').set(authHeader(userToken));
    expect(response.status).toBe(403);
  });

  it('ADMIN cannot access delegation API', async () => {
    const response = await request(app).get('/api/delegations').set(authHeader(adminToken));
    expect(response.status).toBe(403);
  });

  it('creates valid same-company manager delegation', async () => {
    const response = await request(app)
      .post('/api/delegations')
      .set(authHeader(managerToken))
      .send({
        delegatedManagerId: secondManagerId,
        effectiveFrom: iso('2030-01-01T00:00:00.000Z'),
        effectiveUntil: iso('2030-01-31T23:59:59.000Z'),
      });

    expect(response.status).toBe(201);
    expect(response.body.data.delegatedManager.id).toBe(secondManagerId);
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
        effectiveFrom: iso('2030-01-01T00:00:00.000Z'),
        effectiveUntil: iso('2030-01-31T23:59:59.000Z'),
      });

    expect(response.status).toBe(400);
  });

  it('rejects invalid date range', async () => {
    const response = await request(app)
      .post('/api/delegations')
      .set(authHeader(managerToken))
      .send({
        delegatedManagerId: secondManagerId,
        effectiveFrom: iso('2030-02-01T00:00:00.000Z'),
        effectiveUntil: iso('2030-01-01T00:00:00.000Z'),
      });

    expect(response.status).toBe(400);
  });

  it('rejects cross-company delegation', async () => {
    const response = await request(app)
      .post('/api/delegations')
      .set(authHeader(managerToken))
      .send({
        delegatedManagerId: (
          await request(app)
            .post('/api/auth/login')
            .send({ email: 'globex.manager@example.com', password: 'GlobexManager@123' })
        ).body.user.id,
        effectiveFrom: iso('2030-01-01T00:00:00.000Z'),
        effectiveUntil: iso('2030-01-31T23:59:59.000Z'),
      });

    expect(response.status).toBe(404);
  });

  it('lists only the current manager delegations', async () => {
    await request(app)
      .post('/api/delegations')
      .set(authHeader(managerToken))
      .send({
        delegatedManagerId: secondManagerId,
        effectiveFrom: iso('2030-01-01T00:00:00.000Z'),
        effectiveUntil: iso('2030-01-31T23:59:59.000Z'),
      });

    const response = await request(app).get('/api/delegations').set(authHeader(managerToken));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].delegatedManager.id).toBe(secondManagerId);
  });
});
