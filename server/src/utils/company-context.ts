import type { Request } from 'express';
import { AppError } from '../errors/app.error';
import { ErrorCodes } from '../errors/error-codes';
import type { PublicUser } from '../types/auth.types';

export interface CompanyContext {
  companyId: string;
  userId: string;
  role: PublicUser['role'];
}

/**
 * Derives trusted tenant context from the authenticated user loaded server-side.
 * Never use client-supplied companyId/tenantId values for authorization.
 */
export function getCompanyContext(user: PublicUser | undefined): CompanyContext {
  if (!user) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Authentication required');
  }

  return {
    companyId: user.companyId,
    userId: user.id,
    role: user.role,
  };
}

export function getCompanyContextFromRequest(req: Request): CompanyContext {
  return getCompanyContext(req.user);
}

export function assertSameCompany(
  resourceCompanyId: string,
  context: CompanyContext,
  message = 'Resource not found',
): void {
  if (resourceCompanyId !== context.companyId) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, message);
  }
}
