import type { Request, Response, NextFunction } from 'express';
import { parseBody, sendData, sendList } from '../utils/response.util';
import { resolveActiveFilter, getRouteParam, isUuid } from '../utils/query.util';
import {
  createFacilitySchema,
  updateFacilitySchema,
} from '../validators/resource.validators';
import {
  createFacility,
  getFacilityById,
  listFacilities,
  updateFacility,
} from '../services/facility.service';
import { AppError } from '../errors/app.error';
import { ErrorCodes } from '../errors/error-codes';
import { getCompanyContextFromRequest } from '../utils/company-context';

function parseIdParam(id: string, label: string): string {
  if (!isUuid(id)) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `Invalid ${label}`);
  }
  return id;
}

function getActiveFilter(req: Request) {
  if (!req.user) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Authentication required');
  }
  return resolveActiveFilter(req.user.role, req.query.active as string | undefined);
}

export async function listFacilitiesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const facilities = await listFacilities(getActiveFilter(req));
    sendList(res, facilities);
  } catch (error) {
    next(error);
  }
}

export async function getFacilityHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(getRouteParam(req.params.id), 'facility id');
    const facility = await getFacilityById(id, getActiveFilter(req));
    sendData(res, facility);
  } catch (error) {
    next(error);
  }
}

export async function createFacilityHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = parseBody(createFacilitySchema, req.body);
    const { companyId } = getCompanyContextFromRequest(req);
    const facility = await createFacility(input, companyId);
    sendData(res, facility, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateFacilityHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(getRouteParam(req.params.id), 'facility id');
    const input = parseBody(updateFacilitySchema, req.body);
    const facility = await updateFacility(id, input);
    sendData(res, facility);
  } catch (error) {
    next(error);
  }
}
