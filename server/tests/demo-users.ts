import { Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import {
  ACME_CORPORATION_NAME,
  GLOBEX_COMPANY_ID,
  GLOBEX_INDUSTRIES_NAME,
  LEGACY_COMPANY_ID,
} from '../src/constants/company.constants';
import { ensureCompany } from '../src/utils/company-seed';
import { upsertUserByCompanyEmail } from '../src/utils/user-repository';

/** Fake challenge-only credentials — Acme Corporation (Company A) */
export const DEMO_CREDENTIALS = {
  USER: {
    email: 'demo.user@example.com',
    password: 'DemoUser@123',
    role: Role.USER,
    name: 'Demo User',
  },
  MANAGER: {
    email: 'demo.manager@example.com',
    password: 'DemoManager@123',
    role: Role.MANAGER,
    name: 'Demo Manager',
  },
  ADMIN: {
    email: 'demo.admin@example.com',
    password: 'DemoAdmin@123',
    role: Role.ADMIN,
    name: 'Demo Admin',
  },
} as const;

/** Fake challenge-only credentials — Globex Industries (Company B) */
export const GLOBEX_CREDENTIALS = {
  USER: {
    email: 'globex.user@example.com',
    password: 'GlobexUser@123',
    role: Role.USER,
    name: 'Globex User',
  },
  MANAGER: {
    email: 'globex.manager@example.com',
    password: 'GlobexManager@123',
    role: Role.MANAGER,
    name: 'Globex Manager',
  },
  ADMIN: {
    email: 'globex.admin@example.com',
    password: 'GlobexAdmin@123',
    role: Role.ADMIN,
    name: 'Globex Admin',
  },
} as const;

const SALT_ROUNDS = 12;

async function upsertDemoAccounts(
  companyId: string,
  accounts: Record<string, { email: string; password: string; role: Role; name: string }>,
): Promise<void> {
  for (const account of Object.values(accounts)) {
    const passwordHash = await bcrypt.hash(account.password, SALT_ROUNDS);
    await upsertUserByCompanyEmail({
      companyId,
      email: account.email,
      name: account.name,
      passwordHash,
      role: account.role,
      isActive: true,
    });
  }
}

export async function ensureDemoUsersExist(): Promise<void> {
  await ensureCompany(LEGACY_COMPANY_ID, ACME_CORPORATION_NAME);
  await upsertDemoAccounts(LEGACY_COMPANY_ID, DEMO_CREDENTIALS);

  await ensureCompany(GLOBEX_COMPANY_ID, GLOBEX_INDUSTRIES_NAME);
  await upsertDemoAccounts(GLOBEX_COMPANY_ID, GLOBEX_CREDENTIALS);
}
