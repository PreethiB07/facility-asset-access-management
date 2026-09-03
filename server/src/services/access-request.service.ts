import {
  AccessRequestStatus,
  AccessType,
  ApprovalDecision,
  Role,
  type AccessRequest,
  type Area,
  type Asset,
  type Facility,
  type Prisma,
} from '@prisma/client';
import { AppError } from '../errors/app.error';
import { ErrorCodes } from '../errors/error-codes';
import { getDb, runWithCompanyContext } from '../lib/prisma-tenant';
import type {
  AccessRequestResponse,
  AccessTargetInfo,
  ApproverInfo,
  CreateAccessRequestInput,
  CurrentAccessResponse,
  EmployeeSummary,
  ManagerActionResponse,
  PendingAccessRequestResponse,
  UserBrief,
} from '../types/access-request.types';
import { hasActiveDelegationAsDelegate } from './delegation.service';

type AccessRequestWithRelations = AccessRequest & {
  facility: Facility | null;
  area: (Area & { facility: Facility }) | null;
  asset: (Asset & { facility: Facility; area: Area | null }) | null;
};

type AccessRequestWithUsers = AccessRequestWithRelations & {
  createdBy: { id: string; name: string; email: string };
  requestedFor: { id: string; name: string; email: string };
  approvedBy: { id: string; name: string } | null;
};

const userSelect = { id: true, name: true, email: true } as const;

const accessRequestInclude = {
  facility: true,
  area: { include: { facility: true } },
  asset: { include: { facility: true, area: true } },
} satisfies Prisma.AccessRequestInclude;

const accessRequestWithUsersInclude = {
  ...accessRequestInclude,
  createdBy: { select: userSelect },
  requestedFor: { select: userSelect },
} satisfies Prisma.AccessRequestInclude;

const managerAccessRequestInclude = {
  ...accessRequestWithUsersInclude,
  approvedBy: { select: { id: true, name: true } },
} satisfies Prisma.AccessRequestInclude;

function toIsoString(date: Date): string {
  return date.toISOString();
}

function toUserBrief(user: { id: string; name: string; email: string }): UserBrief {
  return { id: user.id, name: user.name, email: user.email };
}

function buildTargetInfo(request: AccessRequestWithRelations): AccessTargetInfo {
  if (request.facility) {
    return {
      type: 'FACILITY',
      id: request.facility.id,
      name: request.facility.name,
      facilityId: request.facility.id,
      facilityName: request.facility.name,
    };
  }

  if (request.area) {
    return {
      type: 'AREA',
      id: request.area.id,
      name: request.area.name,
      facilityId: request.area.facility.id,
      facilityName: request.area.facility.name,
      areaId: request.area.id,
      areaName: request.area.name,
    };
  }

  if (request.asset) {
    return {
      type: 'ASSET',
      id: request.asset.id,
      name: request.asset.name,
      facilityId: request.asset.facility.id,
      facilityName: request.asset.facility.name,
      areaId: request.asset.areaId,
      areaName: request.asset.area?.name ?? null,
    };
  }

  throw new AppError(500, ErrorCodes.INTERNAL_ERROR, 'Access request target could not be resolved');
}

function toAccessRequestResponse(request: AccessRequestWithUsers): AccessRequestResponse {
  return {
    id: request.id,
    accessType: request.accessType,
    startAt: toIsoString(request.startAt),
    endAt: request.endAt ? toIsoString(request.endAt) : null,
    reason: request.reason,
    status: request.status,
    approvedAt: request.approvedAt ? toIsoString(request.approvedAt) : null,
    approvedById: request.approvedById,
    rejectionReason: request.rejectionReason,
    createdAt: toIsoString(request.createdAt),
    updatedAt: toIsoString(request.updatedAt),
    createdBy: toUserBrief(request.createdBy),
    requestedFor: toUserBrief(request.requestedFor),
    target: buildTargetInfo(request),
  };
}

function toCurrentAccessResponse(request: AccessRequestWithRelations): CurrentAccessResponse {
  return {
    id: request.id,
    accessType: request.accessType,
    startAt: toIsoString(request.startAt),
    endAt: request.endAt ? toIsoString(request.endAt) : null,
    reason: request.reason,
    approvedAt: request.approvedAt ? toIsoString(request.approvedAt) : null,
    target: buildTargetInfo(request),
  };
}

interface ResolvedTarget {
  facilityId: string | null;
  areaId: string | null;
  assetId: string | null;
  requiresApproval: boolean;
}

async function resolveAndValidateTarget(
  input: CreateAccessRequestInput,
  _companyId: string,
): Promise<ResolvedTarget> {
  if (input.facilityId) {
    const facility = await getDb().facility.findFirst({
      where: { id: input.facilityId },
    });
    if (!facility) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Facility not found');
    }
    if (!facility.isActive) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Facility is inactive');
    }
    return {
      facilityId: facility.id,
      areaId: null,
      assetId: null,
      requiresApproval: facility.requiresApproval,
    };
  }

  if (input.areaId) {
    const area = await getDb().area.findFirst({
      where: { id: input.areaId },
      include: { facility: true },
    });
    if (!area) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Area not found');
    }
    if (!area.isActive) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Area is inactive');
    }
    if (!area.facility.isActive) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Parent facility is inactive');
    }
    return {
      facilityId: null,
      areaId: area.id,
      assetId: null,
      requiresApproval: area.requiresApproval,
    };
  }

  if (input.assetId) {
    const asset = await getDb().asset.findFirst({
      where: { id: input.assetId },
      include: { facility: true, area: true },
    });
    if (!asset) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Asset not found');
    }
    if (!asset.isActive) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Asset is inactive');
    }
    if (!asset.facility.isActive) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Parent facility is inactive');
    }
    if (asset.areaId && asset.area && !asset.area.isActive) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Parent area is inactive');
    }
    return {
      facilityId: null,
      areaId: null,
      assetId: asset.id,
      requiresApproval: asset.requiresApproval,
    };
  }

  throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Exactly one target must be provided');
}

async function resolveRequestedForId(
  createdById: string,
  requestedForId: string | undefined,
  role: Role,
  companyId: string,
): Promise<string> {
  const beneficiaryId = requestedForId ?? createdById;

  if (beneficiaryId === createdById) {
    return createdById;
  }

  if (role !== Role.MANAGER && role !== Role.ADMIN) {
    throw new AppError(
      403,
      ErrorCodes.FORBIDDEN,
      'Only managers can create access requests on behalf of employees',
    );
  }

  const employee = await getDb().user.findFirst({
    where: { id: beneficiaryId },
    select: { id: true, companyId: true, isActive: true },
  });

  if (!employee || employee.companyId !== companyId) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Employee not found');
  }

  if (!employee.isActive) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Employee account is inactive');
  }

  return employee.id;
}

function isTargetResourceActive(request: AccessRequestWithRelations): boolean {
  if (request.facility) {
    return request.facility.isActive;
  }

  if (request.area) {
    return request.area.isActive && request.area.facility.isActive;
  }

  if (request.asset) {
    const areaActive = request.asset.areaId ? Boolean(request.asset.area?.isActive) : true;
    return request.asset.isActive && request.asset.facility.isActive && areaActive;
  }

  return false;
}

function isCurrentlyValid(request: AccessRequest, now: Date): boolean {
  if (request.status !== AccessRequestStatus.APPROVED) {
    return false;
  }

  if (request.startAt > now) {
    return false;
  }

  if (request.accessType === AccessType.TEMPORARY) {
    return request.endAt !== null && request.endAt > now;
  }

  return request.endAt === null;
}

function assertPendingStatus(status: AccessRequestStatus): void {
  if (status !== AccessRequestStatus.PENDING) {
    throw new AppError(
      409,
      ErrorCodes.CONFLICT,
      `Access request is already ${status.toLowerCase()}`,
    );
  }
}

function validateTargetEligibleForApproval(request: AccessRequestWithRelations): void {
  if (!isTargetResourceActive(request)) {
    throw new AppError(
      400,
      ErrorCodes.VALIDATION_ERROR,
      'Access request target is inactive and cannot be approved',
    );
  }
}

function validateAccessPeriodForApproval(request: AccessRequest, now: Date): void {
  if (request.accessType === AccessType.TEMPORARY) {
    if (!request.endAt || request.endAt <= now) {
      throw new AppError(
        400,
        ErrorCodes.VALIDATION_ERROR,
        'Temporary access request has expired and cannot be approved',
      );
    }
  }
}

function toApproverInfo(user: { id: string; name: string } | null): ApproverInfo | null {
  if (!user) {
    return null;
  }
  return { id: user.id, name: user.name };
}

function toPendingAccessRequestResponse(
  request: AccessRequestWithUsers,
  viewerId: string,
  viewerRole: Role,
): PendingAccessRequestResponse {
  const canApprove =
    (viewerRole === Role.MANAGER || viewerRole === Role.ADMIN) &&
    request.createdById !== viewerId;

  return {
    id: request.id,
    accessType: request.accessType,
    startAt: toIsoString(request.startAt),
    endAt: request.endAt ? toIsoString(request.endAt) : null,
    reason: request.reason,
    status: request.status,
    createdAt: toIsoString(request.createdAt),
    createdBy: toUserBrief(request.createdBy),
    requestedFor: toUserBrief(request.requestedFor),
    target: buildTargetInfo(request),
    canApprove,
  };
}

function toManagerActionResponse(request: AccessRequestWithUsers): ManagerActionResponse {
  return {
    id: request.id,
    status: request.status,
    approvedAt: request.approvedAt ? toIsoString(request.approvedAt) : null,
    approvedBy: toApproverInfo(request.approvedBy),
    rejectionReason: request.rejectionReason,
  };
}

async function loadManagerRequest(requestId: string): Promise<AccessRequestWithUsers> {
  const request = await getDb().accessRequest.findFirst({
    where: { id: requestId },
    include: managerAccessRequestInclude,
  });

  if (!request) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Access request not found');
  }

  return request as AccessRequestWithUsers;
}

async function assertCanApproveOrReject(
  request: AccessRequestWithUsers,
  approverId: string,
  approverRole: Role,
  companyId: string,
  now: Date,
): Promise<void> {
  if (request.createdById === approverId) {
    throw new AppError(
      403,
      ErrorCodes.FORBIDDEN,
      'You cannot approve or reject an access request you created',
    );
  }

  if (approverRole !== Role.MANAGER && approverRole !== Role.ADMIN) {
    throw new AppError(403, ErrorCodes.FORBIDDEN, 'Not authorized to action this request');
  }

  const hasManagerAuthority =
    approverRole === Role.ADMIN ||
    approverRole === Role.MANAGER ||
    (await hasActiveDelegationAsDelegate(approverId, companyId, now));

  if (!hasManagerAuthority) {
    throw new AppError(403, ErrorCodes.FORBIDDEN, 'Not authorized to action this request');
  }
}

function visibilityFilter(userId: string): Prisma.AccessRequestWhereInput {
  return {
    OR: [{ requestedForId: userId }, { createdById: userId }],
  };
}

export async function createAccessRequest(
  createdById: string,
  input: CreateAccessRequestInput,
  companyId: string,
  role: Role,
): Promise<AccessRequestResponse> {
  return runWithCompanyContext(companyId, async () => {
    const creator = await getDb().user.findFirst({
      where: { id: createdById },
      select: { id: true },
    });

    if (!creator) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'User not found');
    }

    const requestedForId = await resolveRequestedForId(
      createdById,
      input.requestedForId,
      role,
      companyId,
    );
    const target = await resolveAndValidateTarget(input, companyId);
    const now = new Date();

    const status = target.requiresApproval
      ? AccessRequestStatus.PENDING
      : AccessRequestStatus.APPROVED;

    const request = await getDb().accessRequest.create({
      data: {
        companyId,
        createdById,
        requestedForId,
        facilityId: target.facilityId,
        areaId: target.areaId,
        assetId: target.assetId,
        accessType: input.accessType,
        startAt: input.startAt,
        endAt: input.endAt,
        reason: input.reason.trim(),
        status,
        approvedAt: status === AccessRequestStatus.APPROVED ? now : null,
        approvedById: null,
      },
      include: accessRequestWithUsersInclude,
    });

    return toAccessRequestResponse(request as AccessRequestWithUsers);
  });
}

export async function listMyAccessRequests(
  userId: string,
  companyId: string,
  status?: AccessRequestStatus,
): Promise<AccessRequestResponse[]> {
  return runWithCompanyContext(companyId, async () => {
    const requests = await getDb().accessRequest.findMany({
      where: {
        ...visibilityFilter(userId),
        ...(status ? { status } : {}),
      },
      include: accessRequestWithUsersInclude,
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((request) => toAccessRequestResponse(request as AccessRequestWithUsers));
  });
}

export async function getAccessRequestById(
  requestId: string,
  userId: string,
  companyId: string,
): Promise<AccessRequestResponse> {
  return runWithCompanyContext(companyId, async () => {
    const request = await getDb().accessRequest.findFirst({
      where: {
        id: requestId,
        ...visibilityFilter(userId),
      },
      include: accessRequestWithUsersInclude,
    });

    if (!request) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Access request not found');
    }

    return toAccessRequestResponse(request as AccessRequestWithUsers);
  });
}

export async function getCurrentAccess(
  userId: string,
  companyId: string,
  now: Date = new Date(),
): Promise<CurrentAccessResponse[]> {
  return runWithCompanyContext(companyId, async () => {
    const requests = await getDb().accessRequest.findMany({
      where: {
        requestedForId: userId,
        status: AccessRequestStatus.APPROVED,
        startAt: { lte: now },
        OR: [
          {
            accessType: AccessType.TEMPORARY,
            endAt: { gt: now },
          },
          {
            accessType: AccessType.PERMANENT,
            endAt: null,
          },
        ],
      },
      include: accessRequestInclude,
      orderBy: { startAt: 'desc' },
    });

    return requests
      .filter((request) => isTargetResourceActive(request) && isCurrentlyValid(request, now))
      .map(toCurrentAccessResponse);
  });
}

export async function listCompanyEmployees(
  companyId: string,
): Promise<EmployeeSummary[]> {
  return runWithCompanyContext(companyId, async () => {
    const users = await getDb().user.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    }));
  });
}

export function mapCreateBodyToInput(body: {
  facilityId?: string;
  areaId?: string;
  assetId?: string;
  accessType: AccessType;
  startAt: string;
  endAt?: string | null;
  reason: string;
  requestedForId?: string;
}): CreateAccessRequestInput {
  return {
    facilityId: body.facilityId,
    areaId: body.areaId,
    assetId: body.assetId,
    accessType: body.accessType,
    startAt: new Date(body.startAt),
    endAt:
      body.accessType === AccessType.PERMANENT
        ? null
        : body.endAt
          ? new Date(body.endAt)
          : null,
    reason: body.reason.trim(),
    requestedForId: body.requestedForId,
  };
}

export async function listPendingAccessRequests(
  companyId: string,
  viewerId: string,
  viewerRole: Role,
): Promise<PendingAccessRequestResponse[]> {
  return runWithCompanyContext(companyId, async () => {
    const requests = await getDb().accessRequest.findMany({
      where: { status: AccessRequestStatus.PENDING },
      include: managerAccessRequestInclude,
      orderBy: { createdAt: 'asc' },
    });

    return requests.map((request) =>
      toPendingAccessRequestResponse(request as AccessRequestWithUsers, viewerId, viewerRole),
    );
  });
}

export async function approveAccessRequest(
  requestId: string,
  approverId: string,
  approverRole: Role,
  companyId: string,
  now: Date = new Date(),
): Promise<ManagerActionResponse> {
  return runWithCompanyContext(companyId, async () => {
    const request = await loadManagerRequest(requestId);
    assertPendingStatus(request.status);
    await assertCanApproveOrReject(request, approverId, approverRole, companyId, now);
    validateTargetEligibleForApproval(request);
    validateAccessPeriodForApproval(request, now);

    const db = getDb();
    const updateResult = await db.accessRequest.updateMany({
      where: {
        id: requestId,
        status: AccessRequestStatus.PENDING,
      },
      data: {
        status: AccessRequestStatus.APPROVED,
        approvedById: approverId,
        approvedAt: now,
        rejectionReason: null,
      },
    });

    if (updateResult.count === 0) {
      throw new AppError(
        409,
        ErrorCodes.CONFLICT,
        'This request has already been processed by another manager',
      );
    }

    await db.approvalHistory.create({
      data: {
        companyId,
        accessRequestId: requestId,
        actorId: approverId,
        decision: ApprovalDecision.APPROVED,
        comment: null,
      },
    });

    const updated = await loadManagerRequest(requestId);
    return toManagerActionResponse(updated);
  });
}

export async function rejectAccessRequest(
  requestId: string,
  approverId: string,
  approverRole: Role,
  rejectionReason: string,
  companyId: string,
  now: Date = new Date(),
): Promise<ManagerActionResponse> {
  return runWithCompanyContext(companyId, async () => {
    const request = await loadManagerRequest(requestId);
    assertPendingStatus(request.status);
    await assertCanApproveOrReject(request, approverId, approverRole, companyId, now);

    const trimmedReason = rejectionReason.trim();
    const db = getDb();

    const updateResult = await db.accessRequest.updateMany({
      where: {
        id: requestId,
        status: AccessRequestStatus.PENDING,
      },
      data: {
        status: AccessRequestStatus.REJECTED,
        approvedById: approverId,
        approvedAt: now,
        rejectionReason: trimmedReason,
      },
    });

    if (updateResult.count === 0) {
      throw new AppError(
        409,
        ErrorCodes.CONFLICT,
        'This request has already been processed by another manager',
      );
    }

    await db.approvalHistory.create({
      data: {
        companyId,
        accessRequestId: requestId,
        actorId: approverId,
        decision: ApprovalDecision.REJECTED,
        comment: trimmedReason,
      },
    });

    const updated = await loadManagerRequest(requestId);
    return toManagerActionResponse(updated);
  });
}
