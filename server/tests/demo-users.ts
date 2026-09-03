import { Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import {
  ACME_CORPORATION_NAME,
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

const SALT_ROUNDS = 12;

export async function ensureDemoUsersExist(): Promise<void> {
  await ensureCompany(LEGACY_COMPANY_ID, ACME_CORPORATION_NAME);

  for (const account of Object.values(DEMO_CREDENTIALS)) {
    const passwordHash = await bcrypt.hash(account.password, SALT_ROUNDS);
    await upsertUserByCompanyEmail({
      companyId: LEGACY_COMPANY_ID,
      email: account.email,
      name: account.name,
      passwordHash,
      role: account.role,
      isActive: true,
    });
  }
}
