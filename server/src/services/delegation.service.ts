import { Role } from '@prisma/client';
import { AppError } from '../errors/app.error';
import { ErrorCodes } from '../errors/error-codes';
import { getDb, runWithCompanyContext } from '../lib/prisma-tenant';
import type {
  ApprovalDelegationResponse,
  CreateApprovalDelegationInput,
} from '../types/delegation.types';

const delegationInclude = {
  delegatingManager: { select: { id: true, name: true, email: true } },
  delegatedManager: { select: { id: true, name: true, email: true } },
} as const;

function toDelegationResponse(
  delegation: {
    id: string;
    effectiveFrom: Date;
    effectiveUntil: Date;
    createdAt: Date;
    delegatingManager: { id: string; name: string; email: string };
    delegatedManager: { id: string; name: string; email: string };
  },
): ApprovalDelegationResponse {
  return {
    id: delegation.id,
    delegatingManager: delegation.delegatingManager,
    delegatedManager: delegation.delegatedManager,
    effectiveFrom: delegation.effectiveFrom.toISOString(),
    effectiveUntil: delegation.effectiveUntil.toISOString(),
    createdAt: delegation.createdAt.toISOString(),
  };
}

function assertManagerRole(role: Role, message: string): void {
  if (role !== Role.MANAGER) {
    throw new AppError(403, ErrorCodes.FORBIDDEN, message);
  }
}

export async function createApprovalDelegation(
  delegatingManagerId: string,
  role: Role,
  companyId: string,
  input: CreateApprovalDelegationInput,
): Promise<ApprovalDelegationResponse> {
  return runWithCompanyContext(companyId, async () => {
    assertManagerRole(role, 'Only managers can create approval delegations');

    if (delegatingManagerId === input.delegatedManagerId) {
      throw new AppError(
        400,
        ErrorCodes.VALIDATION_ERROR,
        'Managers cannot delegate approval authority to themselves',
      );
    }

    if (input.effectiveUntil <= input.effectiveFrom) {
      throw new AppError(
        400,
        ErrorCodes.VALIDATION_ERROR,
        'Delegation end must be after the start',
      );
    }

    const delegate = await getDb().user.findFirst({
      where: { id: input.delegatedManagerId },
      select: { id: true, companyId: true, role: true, isActive: true },
    });

    if (!delegate || delegate.companyId !== companyId) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Delegated manager not found');
    }

    if (!delegate.isActive) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Delegated manager is inactive');
    }

    if (delegate.role !== Role.MANAGER) {
      throw new AppError(
        400,
        ErrorCodes.VALIDATION_ERROR,
        'Delegation target must be a manager',
      );
    }

    const delegation = await getDb().approvalDelegation.create({
      data: {
        companyId,
        delegatingManagerId,
        delegatedManagerId: input.delegatedManagerId,
        effectiveFrom: input.effectiveFrom,
        effectiveUntil: input.effectiveUntil,
      },
      include: delegationInclude,
    });

    return toDelegationResponse(delegation);
  });
}

export async function listApprovalDelegations(
  companyId: string,
  delegatingManagerId: string,
): Promise<ApprovalDelegationResponse[]> {
  return runWithCompanyContext(companyId, async () => {
    const delegations = await getDb().approvalDelegation.findMany({
      where: { companyId, delegatingManagerId },
      include: delegationInclude,
      orderBy: { effectiveFrom: 'desc' },
    });

    return delegations.map(toDelegationResponse);
  });
}

export async function hasActiveDelegationAsDelegate(
  managerId: string,
  companyId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const delegation = await getDb().approvalDelegation.findFirst({
    where: {
      companyId,
      delegatedManagerId: managerId,
      effectiveFrom: { lte: now },
      effectiveUntil: { gt: now },
    },
    select: { id: true },
  });

  return delegation !== null;
}

export async function isDelegationActive(
  delegationId: string,
  companyId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const delegation = await getDb().approvalDelegation.findFirst({
    where: {
      id: delegationId,
      companyId,
      effectiveFrom: { lte: now },
      effectiveUntil: { gt: now },
    },
    select: { id: true },
  });

  return delegation !== null;
}
