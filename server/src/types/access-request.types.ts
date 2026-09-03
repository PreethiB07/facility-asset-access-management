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

export interface UserBrief {
  id: string;
  name: string;
  email: string;
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
  createdBy: UserBrief;
  requestedFor: UserBrief;
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
  requestedForId?: string;
}

export interface ApproverInfo {
  id: string;
  name: string;
}

export interface PendingAccessRequestResponse {
  id: string;
  accessType: AccessType;
  startAt: string;
  endAt: string | null;
  reason: string;
  status: AccessRequestStatus;
  createdAt: string;
  createdBy: UserBrief;
  requestedFor: UserBrief;
  target: AccessTargetInfo;
  canApprove: boolean;
}

export interface ManagerActionResponse {
  id: string;
  status: AccessRequestStatus;
  approvedAt: string | null;
  approvedBy: ApproverInfo | null;
  rejectionReason: string | null;
}

export interface EmployeeSummary {
  id: string;
  name: string;
  email: string;
  role: string;
}
