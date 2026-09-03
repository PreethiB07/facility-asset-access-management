import type { Request, Response, NextFunction } from 'express';
import {
  createApprovalDelegation,
  listApprovalDelegations,
} from '../services/delegation.service';
import { parseBody, sendData, sendList } from '../utils/response.util';
import { createApprovalDelegationSchema } from '../validators/delegation.validators';
import { getCompanyContextFromRequest } from '../utils/company-context';

export async function createApprovalDelegationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId, userId, role } = getCompanyContextFromRequest(req);
    const body = parseBody(createApprovalDelegationSchema, req.body);
    const delegation = await createApprovalDelegation(userId, role, companyId, {
      delegatedManagerId: body.delegatedManagerId,
      effectiveFrom: new Date(body.effectiveFrom),
      effectiveUntil: new Date(body.effectiveUntil),
    });
    sendData(res, delegation, 201);
  } catch (error) {
    next(error);
  }
}

export async function listApprovalDelegationsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { companyId } = getCompanyContextFromRequest(req);
    const delegations = await listApprovalDelegations(companyId);
    sendList(res, delegations);
  } catch (error) {
    next(error);
  }
}
