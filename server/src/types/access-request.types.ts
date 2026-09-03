import type { AccessRequestStatus, AccessType } from '@prisma/client';

export type AccessTargetType = 'FACILITY' | 'AREA' | 'ASSET';

export interface AccessTargetInfo {
  type: AccessTargetType;
  id: string;
  name: string;
  facilityId?: string;
  facilityName?: string;
  areaId?: string | null;
  areaName?: string | null;
}

export interface AccessRequestResponse {
  id: string;
  accessType: AccessType;
  startAt: string;
  endAt: string | null;
  reason: string;
  status: AccessRequestStatus;
  approvedAt: string | null;
  approvedById: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  target: AccessTargetInfo;
}

export interface CurrentAccessResponse {
  id: string;
  accessType: AccessType;
  startAt: string;
  endAt: string | null;
  reason: string;
  approvedAt: string | null;
  target: AccessTargetInfo;
}

export interface CreateAccessRequestInput {
  facilityId?: string;
  areaId?: string;
  assetId?: string;
  accessType: AccessType;
  startAt: Date;
  endAt: Date | null;
  reason: string;
}
