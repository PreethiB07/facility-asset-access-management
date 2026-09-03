import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export type DbClient = Prisma.TransactionClient | typeof prisma;

const dbContext = new AsyncLocalStorage<DbClient>();

/** Returns the active transaction client when inside a tenant/auth/bootstrap scope. */
export function getDb(): DbClient {
  return dbContext.getStore() ?? prisma;
}

async function setSessionConfig(
  tx: Prisma.TransactionClient,
  key: string,
  value: string,
): Promise<void> {
  await tx.$executeRaw`SELECT set_config(${key}, ${value}, true)`;
}

async function runInTransactionScope<T>(
  configs: Array<[string, string]>,
  fn: () => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    for (const [key, value] of configs) {
      await setSessionConfig(tx, key, value);
    }
    return dbContext.run(tx, fn);
  });
}

/** Tenant-scoped application queries (SET LOCAL company id, transaction-bound). */
export async function runWithCompanyContext<T>(
  companyId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return runInTransactionScope([['app.current_company_id', companyId]], fn);
}

/** JWT authentication lookup by user id before company context is established. */
export async function runWithAuthUserLookup<T>(
  userId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return runInTransactionScope([['app.current_user_id', userId]], fn);
}

/** Login email lookup across tenants (limited to matching email rows). */
export async function runWithAuthEmailLookup<T>(email: string, fn: () => Promise<T>): Promise<T> {
  return runInTransactionScope([['app.auth_email_lookup', email.toLowerCase()]], fn);
}

/** Seed, migrations helpers, and test cleanup that require cross-tenant access. */
export async function runWithSystemBootstrap<T>(fn: () => Promise<T>): Promise<T> {
  return runInTransactionScope([['app.system_bootstrap', 'true']], fn);
}

/** Direct RLS testing via raw SQL without application-level company filters. */
export async function runWithRawCompanyContext<T>(
  companyId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await setSessionConfig(tx, 'app.current_company_id', companyId);
    return fn(tx);
  });
}

/** Execute callback as the restricted runtime role (faam_app) for RLS verification. */
export async function runAsAppRole<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL ROLE faam_app');
    return fn(tx);
  });
}
