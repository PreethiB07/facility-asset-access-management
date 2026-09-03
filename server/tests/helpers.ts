import request from 'supertest';
import type { Response } from 'supertest';
import { expect } from 'vitest';
import app from '../src/app';
import { getDb, runWithSystemBootstrap } from '../src/lib/prisma-tenant';

export const TEST_EMAIL_DOMAIN = '@auth-test.example.com';

/** Run direct Prisma queries that bypass tenant RLS (tests/seed cleanup only). */
export async function bootstrapQuery<T>(fn: () => Promise<T>): Promise<T> {
  return runWithSystemBootstrap(fn);
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${TEST_EMAIL_DOMAIN}`;
}

export async function cleanupTestUsers(): Promise<void> {
  await runWithSystemBootstrap(async () => {
    await getDb().accessRequest.deleteMany({
      where: {
        requester: {
          email: {
            endsWith: TEST_EMAIL_DOMAIN,
          },
        },
      },
    });

    await getDb().user.deleteMany({
      where: {
        email: {
          endsWith: TEST_EMAIL_DOMAIN,
        },
      },
    });
  });
}

export async function registerUser(payload: {
  name: string;
  email: string;
  password: string;
}): Promise<Response> {
  return request(app).post('/api/auth/register').send(payload);
}

export async function loginUser(payload: {
  email: string;
  password: string;
}): Promise<Response> {
  return request(app).post('/api/auth/login').send(payload);
}

export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

import { DEMO_CREDENTIALS, GLOBEX_CREDENTIALS } from './demo-users';

export async function getTokenForRole(
  role: 'USER' | 'MANAGER' | 'ADMIN',
): Promise<string> {
  const { email, password } = DEMO_CREDENTIALS[role];

  const response = await loginUser({ email, password });
  if (response.status !== 200) {
    throw new Error(`Failed to login as ${role}`);
  }

  return response.body.token as string;
}

export async function getGlobexTokenForRole(
  role: 'USER' | 'MANAGER' | 'ADMIN',
): Promise<string> {
  const { email, password } = GLOBEX_CREDENTIALS[role];

  const response = await loginUser({ email, password });
  if (response.status !== 200) {
    throw new Error(`Failed to login as Globex ${role}`);
  }

  return response.body.token as string;
}

export const TEST_RESOURCE_PREFIX = '__test_resource__';

export async function cleanupTestResources(): Promise<void> {
  await runWithSystemBootstrap(async () => {
    await getDb().accessRequest.deleteMany({
      where: {
        OR: [
          { reason: { startsWith: TEST_RESOURCE_PREFIX } },
          { facility: { name: { startsWith: TEST_RESOURCE_PREFIX } } },
          { area: { name: { startsWith: TEST_RESOURCE_PREFIX } } },
          { asset: { name: { startsWith: TEST_RESOURCE_PREFIX } } },
        ],
      },
    });

    await getDb().asset.deleteMany({
      where: { name: { startsWith: TEST_RESOURCE_PREFIX } },
    });

    await getDb().area.deleteMany({
      where: { name: { startsWith: TEST_RESOURCE_PREFIX } },
    });

    await getDb().facility.deleteMany({
      where: { name: { startsWith: TEST_RESOURCE_PREFIX } },
    });
  });
}

export function expectNoPasswordHash(body: Record<string, unknown>): void {
  expect(body).not.toHaveProperty('passwordHash');
  if (body.user && typeof body.user === 'object' && body.user !== null) {
    expect(body.user as Record<string, unknown>).not.toHaveProperty('passwordHash');
  }
}
