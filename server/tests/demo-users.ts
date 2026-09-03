import { Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { prisma } from '../src/lib/prisma';

/** Fake challenge-only credentials — same as prisma/seed.ts and docs/demo-accounts.md */
export const DEMO_CREDENTIALS = {
  USER: { email: 'demo.user@example.com', password: 'DemoUser@123', role: Role.USER, name: 'Demo User' },
  MANAGER: {
    email: 'demo.manager@example.com',
    password: 'DemoManager@123',
    role: Role.MANAGER,
    name: 'Demo Manager',
  },
  ADMIN: { email: 'demo.admin@example.com', password: 'DemoAdmin@123', role: Role.ADMIN, name: 'Demo Admin' },
} as const;

const SALT_ROUNDS = 12;

export async function ensureDemoUsersExist(): Promise<void> {
  for (const account of Object.values(DEMO_CREDENTIALS)) {
    const passwordHash = await bcrypt.hash(account.password, SALT_ROUNDS);
    await prisma.user.upsert({
      where: { email: account.email },
      update: {
        name: account.name,
        passwordHash,
        role: account.role,
        isActive: true,
      },
      create: {
        name: account.name,
        email: account.email,
        passwordHash,
        role: account.role,
        isActive: true,
      },
    });
  }
}
