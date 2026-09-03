import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app.error';
import { ErrorCodes } from '../errors/error-codes';
import {
  createAsset,
  getAssetById,
  listAssets,
  updateAsset,
} from '../services/asset.service';
import { getRouteParam, isUuid, resolveActiveFilter } from '../utils/query.util';
import { parseBody, sendData, sendList } from '../utils/response.util';
import { createAssetSchema, updateAssetSchema } from '../validators/resource.validators';
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

export async function listAssetsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = getCompanyContextFromRequest(req);
    const assets = await listAssets(getActiveFilter(req), companyId);
    sendList(res, assets);
  } catch (error) {
    next(error);
  }
}

export async function getAssetHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = getCompanyContextFromRequest(req);
    const id = parseIdParam(getRouteParam(req.params.id), 'asset id');
    const asset = await getAssetById(id, getActiveFilter(req), companyId);
    sendData(res, asset);
  } catch (error) {
    next(error);
  }
}

export async function createAssetHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = getCompanyContextFromRequest(req);
    const input = parseBody(createAssetSchema, req.body);
    const asset = await createAsset(input, companyId);
    sendData(res, asset, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateAssetHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = getCompanyContextFromRequest(req);
    const id = parseIdParam(getRouteParam(req.params.id), 'asset id');
    const input = parseBody(updateAssetSchema, req.body);
    const asset = await updateAsset(id, input, companyId);
    sendData(res, asset);
  } catch (error) {
    next(error);
  }
}
