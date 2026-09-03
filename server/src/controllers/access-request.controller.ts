import type { Request, Response, NextFunction } from 'express';
import { AccessRequestStatus } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../errors/app.error';
import { ErrorCodes } from '../errors/error-codes';
import {
  createAccessRequest,
  getAccessRequestById,
  getCurrentAccess,
  listMyAccessRequests,
  mapCreateBodyToInput,
} from '../services/access-request.service';
import { getRouteParam, isUuid } from '../utils/query.util';
import { parseBody, sendData, sendList } from '../utils/response.util';
import {
  accessRequestStatusFilterSchema,
  createAccessRequestSchema,
} from '../validators/access-request.validators';
import { formatZodError } from '../validators/auth.validators';

function parseRequestId(id: string | string[]): string {
  const value = getRouteParam(id);
  if (!isUuid(value)) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Invalid access request id');
  }
  return value;
}

function requireAuthenticatedUser(req: Request): { id: string } {
  if (!req.user) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Authentication required');
  }
  return req.user;
}

export async function createAccessRequestHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const body = parseBody(createAccessRequestSchema, req.body);
    const input = mapCreateBodyToInput(body);
    const request = await createAccessRequest(user.id, input);
    sendData(res, request, 201);
  } catch (error) {
    next(error);
  }
}

export async function listAccessRequestsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const statusParam = req.query.status as string | undefined;
    let status: AccessRequestStatus | undefined;

    if (statusParam) {
      try {
        status = accessRequestStatusFilterSchema.parse(statusParam);
      } catch (error) {
        if (error instanceof ZodError) {
          throw new AppError(400, ErrorCodes.VALIDATION_ERROR, formatZodError(error));
        }
        throw error;
      }
    }

    const requests = await listMyAccessRequests(user.id, status);
    sendList(res, requests);
  } catch (error) {
    next(error);
  }
}

export async function getAccessRequestHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const requestId = parseRequestId(req.params.id);
    const request = await getAccessRequestById(requestId, user.id);
    sendData(res, request);
  } catch (error) {
    next(error);
  }
}

export async function getMyAccessHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const access = await getCurrentAccess(user.id);
    sendList(res, access);
  } catch (error) {
    next(error);
  }
}
