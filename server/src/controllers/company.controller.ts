import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app.error';
import { ErrorCodes } from '../errors/error-codes';
import { getCompanyDetails } from '../services/company.service';
import { sendData } from '../utils/response.util';
import { getCompanyContextFromRequest } from '../utils/company-context';
import { getRouteParam, isUuid } from '../utils/query.util';

export async function getMyCompanyHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = getCompanyContextFromRequest(req);
    const company = await getCompanyDetails(companyId);
    sendData(res, company);
  } catch (error) {
    next(error);
  }
}

export async function getCompanyByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = getCompanyContextFromRequest(req);
    const requestedId = getRouteParam(req.params.id);

    if (!isUuid(requestedId)) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Invalid company ID');
    }

    if (requestedId !== companyId) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Company not found');
    }

    const company = await getCompanyDetails(companyId);
    sendData(res, company);
  } catch (error) {
    next(error);
  }
}
