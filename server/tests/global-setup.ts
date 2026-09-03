import dotenv from 'dotenv';
import { ensureDemoUsersExist } from './demo-users';
import { prisma } from '../src/lib/prisma';

export default async function globalSetup() {
  dotenv.config();

  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test-jwt-secret-for-development-only';
  }

  if (!process.env.JWT_EXPIRES_IN) {
    process.env.JWT_EXPIRES_IN = '1h';
  }

  await ensureDemoUsersExist();

  return async () => {
    await prisma.$disconnect();
  };
}
