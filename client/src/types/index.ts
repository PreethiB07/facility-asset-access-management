export type Role = 'USER' | 'MANAGER' | 'ADMIN';

export type AccessType = 'TEMPORARY' | 'PERMANENT';

export type AccessRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type AccessTargetType = 'FACILITY' | 'AREA' | 'ASSET';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export interface AuthTokenResponse {
  token: string;
  user: User;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export interface Facility {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  requiresApproval: boolean;
}

export interface Area {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  requiresApproval: boolean;
}

export interface AreaDetail extends Area {
  facilityId: string;
}

export interface FacilityDetail extends Facility {
  areas: Area[];
}

export interface Asset {
  id: string;
  facilityId: string;
  areaId: string | null;
  name: string;
  description: string | null;
  isActive: boolean;
  requiresApproval: boolean;
}

export interface AccessTargetInfo {
  type: AccessTargetType;
  id: string;
  name: string;
  facilityId?: string;
  facilityName?: string;
  areaId?: string | null;
  areaName?: string | null;
}

export interface AccessRequest {
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

export interface CurrentAccess {
  id: string;
  accessType: AccessType;
  startAt: string;
  endAt: string | null;
  reason: string;
  approvedAt: string | null;
  target: AccessTargetInfo;
}

export interface RequesterInfo {
  id: string;
  name: string;
  email: string;
}

export interface PendingAccessRequest {
  id: string;
  accessType: AccessType;
  startAt: string;
  endAt: string | null;
  reason: string;
  status: AccessRequestStatus;
  createdAt: string;
  requester: RequesterInfo;
  target: AccessTargetInfo;
}

export interface CreateAccessRequestPayload {
  facilityId?: string;
  areaId?: string;
  assetId?: string;
  accessType: AccessType;
  startAt: string;
  endAt?: string | null;
  reason: string;
}

export interface AccessRequestTarget {
  type: AccessTargetType;
  facilityId?: string;
  areaId?: string;
  assetId?: string;
  name: string;
  facilityName?: string;
  areaName?: string | null;
}
