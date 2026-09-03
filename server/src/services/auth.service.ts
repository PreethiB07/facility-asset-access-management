import bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { AppError } from '../errors/app.error';
import { ErrorCodes } from '../errors/error-codes';
import { prisma } from '../lib/prisma';
import type { AuthTokenResponse, LoginInput, PublicUser, RegisterInput } from '../types/auth.types';
import { signToken } from '../utils/jwt.util';
import { toPublicUser } from '../utils/user.mapper';
import { getDefaultRegistrationCompanyId } from './company.service';
import { findUserByCompanyEmail } from '../utils/user-repository';

const SALT_ROUNDS = 12;

export async function registerUser(input: RegisterInput): Promise<AuthTokenResponse> {
  const normalizedEmail = input.email.toLowerCase();
  const companyId = await getDefaultRegistrationCompanyId();

  const existingUser = await findUserByCompanyEmail(companyId, normalizedEmail);

  if (existingUser) {
    throw new AppError(409, ErrorCodes.CONFLICT, 'Email is already registered');
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      companyId,
      name: input.name,
      email: normalizedEmail,
      passwordHash,
      role: Role.USER,
      isActive: true,
    },
  });

  const token = signToken({ userId: user.id, role: user.role });

  return {
    token,
    user: toPublicUser(user),
  };
}

export async function loginUser(input: LoginInput): Promise<AuthTokenResponse> {
  const normalizedEmail = input.email.toLowerCase();

  const candidates = await prisma.user.findMany({
    where: { email: normalizedEmail },
  });

  if (candidates.length === 0) {
    throw new AppError(401, ErrorCodes.INVALID_CREDENTIALS, 'Invalid email or password');
  }

  let user = null;
  for (const candidate of candidates) {
    const passwordMatches = await bcrypt.compare(input.password, candidate.passwordHash);
    if (passwordMatches) {
      user = candidate;
      break;
    }
  }

  if (!user) {
    throw new AppError(401, ErrorCodes.INVALID_CREDENTIALS, 'Invalid email or password');
  }

  if (!user.isActive) {
    throw new AppError(403, ErrorCodes.ACCOUNT_INACTIVE, 'Account is inactive');
  }

  const token = signToken({ userId: user.id, role: user.role });

  return {
    token,
    user: toPublicUser(user),
  };
}

export async function getUserById(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'User not found');
  }

  if (!user.isActive) {
    throw new AppError(403, ErrorCodes.ACCOUNT_INACTIVE, 'Account is inactive');
  }

  return toPublicUser(user);
}
