import type { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { AppError } from '../errors/app.error';
import { ErrorCodes } from '../errors/error-codes';
import { getUserById } from '../services/auth.service';
import { verifyToken } from '../utils/jwt.util';

function extractBearerToken(req: Request): string {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Authentication token is required');
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Malformed authentication token');
  }

  return token;
}

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractBearerToken(req);
    const payload = verifyToken(token);
    req.user = await getUserById(payload.userId);
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, ErrorCodes.UNAUTHORIZED, 'Authentication required'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new AppError(403, ErrorCodes.FORBIDDEN, 'Insufficient permissions'));
      return;
    }

    next();
  };
}
