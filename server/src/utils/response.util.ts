import { ZodError, type ZodType } from 'zod';
import { AppError } from '../errors/app.error';
import { ErrorCodes } from '../errors/error-codes';
import { formatZodError } from '../validators/auth.validators';

export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, formatZodError(error));
    }
    throw error;
  }
}

export function sendData<T>(res: import('express').Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({ data });
}

export function sendList<T>(res: import('express').Response, data: T[]): void {
  res.status(200).json({ data });
}
