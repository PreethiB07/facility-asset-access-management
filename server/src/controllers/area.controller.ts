import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app.error';
import { ErrorCodes } from '../errors/error-codes';
import {
  createArea,
  getAreaById,
  listAreasByFacility,
  updateArea,
} from '../services/area.service';
import { listAssetsByArea } from '../services/asset.service';
import { getRouteParam, isUuid, resolveActiveFilter } from '../utils/query.util';
import { parseBody, sendData, sendList } from '../utils/response.util';
import { createAreaSchema, updateAreaSchema } from '../validators/resource.validators';
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

export async function listFacilityAreasHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = getCompanyContextFromRequest(req);
    const facilityId = parseIdParam(getRouteParam(req.params.facilityId), 'facility id');
    const areas = await listAreasByFacility(facilityId, getActiveFilter(req), companyId);
    sendList(res, areas);
  } catch (error) {
    next(error);
  }
}

export async function getAreaHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = getCompanyContextFromRequest(req);
    const id = parseIdParam(getRouteParam(req.params.id), 'area id');
    const area = await getAreaById(id, getActiveFilter(req), companyId);
    sendData(res, area);
  } catch (error) {
    next(error);
  }
}

export async function createAreaHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = getCompanyContextFromRequest(req);
    const facilityId = parseIdParam(getRouteParam(req.params.facilityId), 'facility id');
    const input = parseBody(createAreaSchema, req.body);
    const area = await createArea(facilityId, input, companyId);
    sendData(res, area, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateAreaHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = getCompanyContextFromRequest(req);
    const id = parseIdParam(getRouteParam(req.params.id), 'area id');
    const input = parseBody(updateAreaSchema, req.body);
    const area = await updateArea(id, input, companyId);
    sendData(res, area);
  } catch (error) {
    next(error);
  }
}

export async function listAreaAssetsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = getCompanyContextFromRequest(req);
    const areaId = parseIdParam(getRouteParam(req.params.areaId), 'area id');
    const assets = await listAssetsByArea(areaId, getActiveFilter(req), companyId);
    sendList(res, assets);
  } catch (error) {
    next(error);
  }
}
