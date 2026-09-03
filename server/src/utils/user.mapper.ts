import type { User } from '@prisma/client';
import type { PublicUser } from '../types/auth.types';

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    companyId: user.companyId,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  };
}

export function assertNoPasswordHash(payload: Record<string, unknown>): void {
  if ('passwordHash' in payload) {
    throw new Error('passwordHash must not be exposed in API responses');
  }
}
