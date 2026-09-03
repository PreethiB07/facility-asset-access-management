import request from 'supertest';
import type { Response } from 'supertest';
import { expect } from 'vitest';
import app from '../src/app';
import { prisma } from '../src/lib/prisma';

export const TEST_EMAIL_DOMAIN = '@auth-test.example.com';

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${TEST_EMAIL_DOMAIN}`;
}

export async function cleanupTestUsers(): Promise<void> {
  await prisma.user.deleteMany({
    where: {
      email: {
        endsWith: TEST_EMAIL_DOMAIN,
      },
    },
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

export async function getTokenForRole(
  role: 'USER' | 'MANAGER' | 'ADMIN',
): Promise<string> {
  const credentials: Record<'USER' | 'MANAGER' | 'ADMIN', { email: string; env: string }> = {
    USER: { email: 'user@example.com', env: 'SEED_USER_PASSWORD' },
    MANAGER: { email: 'manager@example.com', env: 'SEED_MANAGER_PASSWORD' },
    ADMIN: { email: 'admin@example.com', env: 'SEED_ADMIN_PASSWORD' },
  };

  const { email, env } = credentials[role];
  const password = process.env[env];
  if (!password) {
    throw new Error(`Missing ${env} for test authentication`);
  }

  const response = await loginUser({ email, password });
  if (response.status !== 200) {
    throw new Error(`Failed to login as ${role}`);
  }

  return response.body.token as string;
}

export const TEST_RESOURCE_PREFIX = '__test_resource__';

export async function cleanupTestResources(): Promise<void> {
  await prisma.accessRequest.deleteMany({
    where: {
      OR: [
        { reason: { startsWith: TEST_RESOURCE_PREFIX } },
        { facility: { name: { startsWith: TEST_RESOURCE_PREFIX } } },
        { area: { name: { startsWith: TEST_RESOURCE_PREFIX } } },
        { asset: { name: { startsWith: TEST_RESOURCE_PREFIX } } },
      ],
    },
  });

  await prisma.asset.deleteMany({
    where: { name: { startsWith: TEST_RESOURCE_PREFIX } },
  });

  await prisma.area.deleteMany({
    where: { name: { startsWith: TEST_RESOURCE_PREFIX } },
  });

  await prisma.facility.deleteMany({
    where: { name: { startsWith: TEST_RESOURCE_PREFIX } },
  });
}

export function expectNoPasswordHash(body: Record<string, unknown>): void {
  expect(body).not.toHaveProperty('passwordHash');
  if (body.user && typeof body.user === 'object' && body.user !== null) {
    expect(body.user as Record<string, unknown>).not.toHaveProperty('passwordHash');
  }
}
