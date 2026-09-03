import type { Request, Response, NextFunction } from 'express';
import { AccessRequestStatus } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../errors/app.error';
import { ErrorCodes } from '../errors/error-codes';
import {
  approveAccessRequest,
  createAccessRequest,
  getAccessRequestById,
  getCurrentAccess,
  listMyAccessRequests,
  listPendingAccessRequests,
  mapCreateBodyToInput,
  rejectAccessRequest,
} from '../services/access-request.service';
import { getRouteParam, isUuid } from '../utils/query.util';
import { parseBody, sendData, sendList } from '../utils/response.util';
import {
  accessRequestStatusFilterSchema,
  createAccessRequestSchema,
  rejectAccessRequestSchema,
} from '../validators/access-request.validators';
import { formatZodError } from '../validators/auth.validators';
import { getCompanyContextFromRequest } from '../utils/company-context';

function parseRequestId(id: string | string[]): string {
  const value = getRouteParam(id);
  if (!isUuid(value)) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Invalid access request id');
  }
  return value;
}

export async function createAccessRequestHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId, userId } = getCompanyContextFromRequest(req);
    const body = parseBody(createAccessRequestSchema, req.body);
    const input = mapCreateBodyToInput(body);
    const request = await createAccessRequest(userId, input, companyId);
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
    const { companyId, userId } = getCompanyContextFromRequest(req);
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

    const requests = await listMyAccessRequests(userId, companyId, status);
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
    const { companyId, userId } = getCompanyContextFromRequest(req);
    const requestId = parseRequestId(req.params.id);
    const request = await getAccessRequestById(requestId, userId, companyId);
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
    const { companyId, userId } = getCompanyContextFromRequest(req);
    const access = await getCurrentAccess(userId, companyId);
    sendList(res, access);
  } catch (error) {
    next(error);
  }
}

export async function listPendingAccessRequestsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = getCompanyContextFromRequest(req);
    const requests = await listPendingAccessRequests(companyId);
    sendList(res, requests);
  } catch (error) {
    next(error);
  }
}

export async function approveAccessRequestHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId, userId } = getCompanyContextFromRequest(req);
    const requestId = parseRequestId(req.params.id);
    const result = await approveAccessRequest(requestId, userId, companyId);
    sendData(res, result);
  } catch (error) {
    next(error);
  }
}

export async function rejectAccessRequestHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId, userId } = getCompanyContextFromRequest(req);
    const requestId = parseRequestId(req.params.id);
    const body = parseBody(rejectAccessRequestSchema, req.body);
    const result = await rejectAccessRequest(requestId, userId, body.rejectionReason, companyId);
    sendData(res, result);
  } catch (error) {
    next(error);
  }
}
