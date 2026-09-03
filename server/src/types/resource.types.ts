import type { Area, Asset, Facility } from '@prisma/client';

export interface FacilitySummary {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  requiresApproval: boolean;
}

export interface AreaSummary {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  requiresApproval: boolean;
}

export interface AreaDetail extends AreaSummary {
  facilityId: string;
}

export interface AssetSummary {
  id: string;
  facilityId: string;
  areaId: string | null;
  name: string;
  description: string | null;
  isActive: boolean;
  requiresApproval: boolean;
}

export interface FacilityDetail extends FacilitySummary {
  areas: AreaSummary[];
}

export function toFacilitySummary(facility: Facility): FacilitySummary {
  return {
    id: facility.id,
    name: facility.name,
    description: facility.description,
    isActive: facility.isActive,
    requiresApproval: facility.requiresApproval,
  };
}

export function toAreaSummary(area: Area): AreaSummary {
  return {
    id: area.id,
    name: area.name,
    description: area.description,
    isActive: area.isActive,
    requiresApproval: area.requiresApproval,
  };
}

export function toAreaDetail(area: Area): AreaDetail {
  return {
    ...toAreaSummary(area),
    facilityId: area.facilityId,
  };
}

export function toAssetSummary(asset: Asset): AssetSummary {
  return {
    id: asset.id,
    facilityId: asset.facilityId,
    areaId: asset.areaId,
    name: asset.name,
    description: asset.description,
    isActive: asset.isActive,
    requiresApproval: asset.requiresApproval,
  };
}
