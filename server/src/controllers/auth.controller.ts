import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app.error';
import { ErrorCodes } from '../errors/error-codes';
import { getUserById, loginUser, registerUser } from '../services/auth.service';
import { formatZodError, loginSchema, registerSchema } from '../validators/auth.validators';

function handleValidation<T>(schema: { parse: (input: unknown) => T }, body: unknown): T {
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, formatZodError(error));
    }
    throw error;
  }
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = handleValidation(registerSchema, req.body);
    const result = await registerUser(input);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = handleValidation(loginSchema, req.body);
    const result = await loginUser(input);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Authentication required');
    }

    const user = await getUserById(req.user.id);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
}

export function protectedTest(req: Request, res: Response): void {
  res.status(200).json({
    message: 'Authenticated access granted',
    user: req.user,
  });
}

export function protectedUserTest(_req: Request, res: Response): void {
  res.status(200).json({ message: 'USER role access granted' });
}

export function protectedManagerTest(_req: Request, res: Response): void {
  res.status(200).json({ message: 'MANAGER role access granted' });
}

export function protectedAdminTest(_req: Request, res: Response): void {
  res.status(200).json({ message: 'ADMIN role access granted' });
}
