import {
  AccessRequestStatus,
  AccessType,
  type AccessRequest,
  type Area,
  type Asset,
  type Facility,
  type Prisma,
} from '@prisma/client';
import { AppError } from '../errors/app.error';
import { ErrorCodes } from '../errors/error-codes';
import { prisma } from '../lib/prisma';
import type {
  AccessRequestResponse,
  AccessTargetInfo,
  CreateAccessRequestInput,
  CurrentAccessResponse,
} from '../types/access-request.types';

type AccessRequestWithRelations = AccessRequest & {
  facility: Facility | null;
  area: (Area & { facility: Facility }) | null;
  asset: (Asset & { facility: Facility; area: Area | null }) | null;
};

const accessRequestInclude = {
  facility: true,
  area: { include: { facility: true } },
  asset: { include: { facility: true, area: true } },
} satisfies Prisma.AccessRequestInclude;

function toIsoString(date: Date): string {
  return date.toISOString();
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

function toAccessRequestResponse(request: AccessRequestWithRelations): AccessRequestResponse {
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

async function resolveAndValidateTarget(input: CreateAccessRequestInput): Promise<ResolvedTarget> {
  if (input.facilityId) {
    const facility = await prisma.facility.findUnique({ where: { id: input.facilityId } });
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
    const area = await prisma.area.findUnique({
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
    const asset = await prisma.asset.findUnique({
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

export async function createAccessRequest(
  requesterId: string,
  input: CreateAccessRequestInput,
): Promise<AccessRequestResponse> {
  const target = await resolveAndValidateTarget(input);
  const now = new Date();

  const status = target.requiresApproval
    ? AccessRequestStatus.PENDING
    : AccessRequestStatus.APPROVED;

  const request = await prisma.accessRequest.create({
    data: {
      requesterId,
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
    include: accessRequestInclude,
  });

  return toAccessRequestResponse(request);
}

export async function listMyAccessRequests(
  requesterId: string,
  status?: AccessRequestStatus,
): Promise<AccessRequestResponse[]> {
  const requests = await prisma.accessRequest.findMany({
    where: {
      requesterId,
      ...(status ? { status } : {}),
    },
    include: accessRequestInclude,
    orderBy: { createdAt: 'desc' },
  });

  return requests.map(toAccessRequestResponse);
}

export async function getAccessRequestById(
  requestId: string,
  requesterId: string,
): Promise<AccessRequestResponse> {
  const request = await prisma.accessRequest.findFirst({
    where: { id: requestId, requesterId },
    include: accessRequestInclude,
  });

  if (!request) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Access request not found');
  }

  return toAccessRequestResponse(request);
}

export async function getCurrentAccess(
  requesterId: string,
  now: Date = new Date(),
): Promise<CurrentAccessResponse[]> {
  const requests = await prisma.accessRequest.findMany({
    where: {
      requesterId,
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
}

export function mapCreateBodyToInput(body: {
  facilityId?: string;
  areaId?: string;
  assetId?: string;
  accessType: AccessType;
  startAt: string;
  endAt?: string | null;
  reason: string;
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
  };
}
