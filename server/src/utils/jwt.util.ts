import jwt, { type SignOptions } from 'jsonwebtoken';
import { AppError } from '../errors/app.error';
import { ErrorCodes } from '../errors/error-codes';
import type { JwtPayload } from '../types/auth.types';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError(500, ErrorCodes.INTERNAL_ERROR, 'JWT secret is not configured');
  }
  return secret;
}

function getJwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN ?? '24h';
}

export function signToken(payload: JwtPayload): string {
  const options: SignOptions = { expiresIn: getJwtExpiresIn() as SignOptions['expiresIn'] };
  return jwt.sign(payload, getJwtSecret(), options);
}

export function verifyToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (typeof decoded !== 'object' || decoded === null) {
      throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Invalid authentication token');
    }

    const { userId, role } = decoded as JwtPayload;
    if (!userId || !role) {
      throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Invalid authentication token');
    }

    return { userId, role };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Authentication token has expired');
    }

    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Invalid authentication token');
    }

    throw error;
  }
}

export function signExpiredToken(payload: JwtPayload): string {
  const options: SignOptions = { expiresIn: '-1s' as SignOptions['expiresIn'] };
  return jwt.sign(payload, getJwtSecret(), options);
}

export { getJwtSecret };
