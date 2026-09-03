import bcrypt from 'bcrypt';
import request from 'supertest';
import { Role } from '@prisma/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import app from '../src/app';
import { getDb } from '../src/lib/prisma-tenant';
import { signExpiredToken, signToken } from '../src/utils/jwt.util';
import {
  authHeader,
  bootstrapQuery,
  cleanupTestUsers,
  expectNoPasswordHash,
  loginUser,
  registerUser,
  uniqueEmail,
} from './helpers';

const VALID_PASSWORD = 'Password123!';

describe('POST /api/auth/register', () => {
  afterEach(async () => {
    await cleanupTestUsers();
  });

  it('registers a valid user', async () => {
    const email = uniqueEmail('register-valid');
    const response = await registerUser({
      name: 'John Doe',
      email,
      password: VALID_PASSWORD,
    });

    expect(response.status).toBe(201);
    expect(response.body.token).toBeTypeOf('string');
    expect(response.body.user).toMatchObject({
      name: 'John Doe',
      email: email.toLowerCase(),
      role: Role.USER,
      isActive: true,
    });
    expectNoPasswordHash(response.body);
  });

  it('rejects missing name', async () => {
    const response = await registerUser({
      name: '',
      email: uniqueEmail('missing-name'),
      password: VALID_PASSWORD,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid email', async () => {
    const response = await registerUser({
      name: 'John Doe',
      email: 'not-an-email',
      password: VALID_PASSWORD,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects missing password', async () => {
    const response = await registerUser({
      name: 'John Doe',
      email: uniqueEmail('missing-password'),
      password: '',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects password that is too short', async () => {
    const response = await registerUser({
      name: 'John Doe',
      email: uniqueEmail('short-password'),
      password: 'short',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects duplicate email', async () => {
    const email = uniqueEmail('duplicate');
    await registerUser({ name: 'First User', email, password: VALID_PASSWORD });

    const response = await registerUser({
      name: 'Second User',
      email,
      password: VALID_PASSWORD,
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('stores password as a hash', async () => {
    const email = uniqueEmail('hash-check');
    await registerUser({ name: 'Hash User', email, password: VALID_PASSWORD });

    const user = await bootstrapQuery(() =>
      getDb().user.findFirst({ where: { email: email.toLowerCase() } }),
    );
    expect(user?.passwordHash).toBeDefined();
    expect(user?.passwordHash).not.toBe(VALID_PASSWORD);
    expect(await bcrypt.compare(VALID_PASSWORD, user!.passwordHash)).toBe(true);
  });

  it('creates USER role for normal registration', async () => {
    const email = uniqueEmail('role-check');
    const response = await registerUser({
      name: 'Role User',
      email,
      password: VALID_PASSWORD,
    });

    expect(response.body.user.role).toBe(Role.USER);
  });

  it('does not return passwordHash', async () => {
    const response = await registerUser({
      name: 'Safe User',
      email: uniqueEmail('no-hash'),
      password: VALID_PASSWORD,
    });

    expectNoPasswordHash(response.body);
  });
});

describe('POST /api/auth/login', () => {
  const password = VALID_PASSWORD;
  let email = '';

  beforeEach(async () => {
    email = uniqueEmail('login-user');
    await registerUser({ name: 'Login User', email, password });
  });

  afterEach(async () => {
    await cleanupTestUsers();
  });

  it('logs in with valid credentials', async () => {
    const response = await loginUser({ email, password });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeTypeOf('string');
    expect(response.body.user.email).toBe(email.toLowerCase());
    expectNoPasswordHash(response.body);
  });

  it('rejects invalid email', async () => {
    const response = await loginUser({ email: 'missing@auth-test.example.com', password });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects invalid password', async () => {
    const response = await loginUser({ email, password: 'WrongPassword123!' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('prevents inactive user login', async () => {
    const inactiveEmail = uniqueEmail('inactive');
    const created = await registerUser({
      name: 'Inactive User',
      email: inactiveEmail,
      password,
    });

    await bootstrapQuery(() =>
      getDb().user.update({
        where: { id: created.body.user.id },
        data: { isActive: false },
      }),
    );

    const response = await loginUser({ email: inactiveEmail, password });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ACCOUNT_INACTIVE');
  });

  it('returns a JWT', async () => {
    const response = await loginUser({ email, password });
    expect(response.body.token.split('.')).toHaveLength(3);
  });

  it('never returns passwordHash', async () => {
    const response = await loginUser({ email, password });
    expectNoPasswordHash(response.body);
  });
});

describe('Authentication middleware', () => {
  let activeToken = '';
  let activeUserId = '';

  beforeEach(async () => {
    const email = uniqueEmail('auth-middleware');
    const registered = await registerUser({
      name: 'Auth Middleware User',
      email,
      password: VALID_PASSWORD,
    });
    activeToken = registered.body.token;
    activeUserId = registered.body.user.id;
  });

  afterEach(async () => {
    await cleanupTestUsers();
  });

  it('accepts a valid JWT', async () => {
    const response = await request(app)
      .get('/api/auth/protected-test')
      .set(authHeader(activeToken));

    expect(response.status).toBe(200);
    expect(response.body.user.id).toBe(activeUserId);
    expectNoPasswordHash(response.body.user);
  });

  it('rejects missing JWT', async () => {
    const response = await request(app).get('/api/auth/protected-test');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects malformed JWT header', async () => {
    const response = await request(app)
      .get('/api/auth/protected-test')
      .set('Authorization', 'NotBearer token');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects invalid JWT', async () => {
    const response = await request(app)
      .get('/api/auth/protected-test')
      .set(authHeader('invalid.jwt.token'));

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects expired JWT', async () => {
    const expiredToken = signExpiredToken({ userId: activeUserId, role: Role.USER });
    const response = await request(app)
      .get('/api/auth/protected-test')
      .set(authHeader(expiredToken));

    expect(response.status).toBe(401);
    expect(response.body.error.message).toMatch(/expired/i);
  });

  it('rejects token for nonexistent user', async () => {
    const token = signToken({ userId: '00000000-0000-0000-0000-000000000000', role: Role.USER });
    const response = await request(app)
      .get('/api/auth/protected-test')
      .set(authHeader(token));

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects inactive user with valid JWT', async () => {
    const inactiveEmail = uniqueEmail('inactive-jwt');
    const registered = await registerUser({
      name: 'Inactive JWT User',
      email: inactiveEmail,
      password: VALID_PASSWORD,
    });

    await bootstrapQuery(() =>
      getDb().user.update({
        where: { id: registered.body.user.id },
        data: { isActive: false },
      }),
    );

    const response = await request(app)
      .get('/api/auth/protected-test')
      .set(authHeader(registered.body.token));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ACCOUNT_INACTIVE');
  });
});

describe('GET /api/auth/me', () => {
  afterEach(async () => {
    await cleanupTestUsers();
  });

  it('returns the current user', async () => {
    const email = uniqueEmail('me-endpoint');
    const registered = await registerUser({
      name: 'Me User',
      email,
      password: VALID_PASSWORD,
    });

    const response = await request(app)
      .get('/api/auth/me')
      .set(authHeader(registered.body.token));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      name: 'Me User',
      email: email.toLowerCase(),
      role: Role.USER,
      isActive: true,
    });
    expectNoPasswordHash(response.body);
  });
});

import { DEMO_CREDENTIALS } from './demo-users';

describe('Role authorization', () => {
  async function loginSeedUser(role: keyof typeof DEMO_CREDENTIALS): Promise<string> {
    const { email, password } = DEMO_CREDENTIALS[role];

    const response = await loginUser({ email, password });
    expect(response.status).toBe(200);
    return response.body.token as string;
  }

  it('allows USER to access USER-protected endpoint', async () => {
    const token = await loginSeedUser('USER');
    const response = await request(app)
      .get('/api/auth/protected-test/user')
      .set(authHeader(token));

    expect(response.status).toBe(200);
  });

  it('denies USER access to MANAGER endpoint', async () => {
    const token = await loginSeedUser('USER');
    const response = await request(app)
      .get('/api/auth/protected-test/manager')
      .set(authHeader(token));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('allows MANAGER to access MANAGER endpoint', async () => {
    const token = await loginSeedUser('MANAGER');
    const response = await request(app)
      .get('/api/auth/protected-test/manager')
      .set(authHeader(token));

    expect(response.status).toBe(200);
  });

  it('allows ADMIN to access ADMIN endpoint', async () => {
    const token = await loginSeedUser('ADMIN');
    const response = await request(app)
      .get('/api/auth/protected-test/admin')
      .set(authHeader(token));

    expect(response.status).toBe(200);
  });

  it('returns 403 for unauthorized role', async () => {
    const token = await loginSeedUser('USER');
    const response = await request(app)
      .get('/api/auth/protected-test/admin')
      .set(authHeader(token));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });
});
