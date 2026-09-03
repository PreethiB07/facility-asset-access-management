import request from 'supertest';
import type { Response } from 'supertest';
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

export function expectNoPasswordHash(body: Record<string, unknown>): void {
  expect(body).not.toHaveProperty('passwordHash');
  if (body.user && typeof body.user === 'object' && body.user !== null) {
    expect(body.user as Record<string, unknown>).not.toHaveProperty('passwordHash');
  }
}
