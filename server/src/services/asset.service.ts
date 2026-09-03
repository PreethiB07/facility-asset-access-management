import { AppError } from '../errors/app.error';
import { ErrorCodes } from '../errors/error-codes';
import { prisma } from '../lib/prisma';
import type { ActiveFilter } from '../utils/query.util';
import type { AssetSummary } from '../types/resource.types';
import { toAssetSummary } from '../types/resource.types';
import type { CreateAssetInput, UpdateAssetInput } from '../validators/resource.validators';
import { assertAreaBelongsToFacility, assertAreaExists } from './area.service';
import { assertFacilityExists } from './facility.service';

async function validateAssetRelationships(
  facilityId: string,
  areaId: string | null | undefined,
): Promise<void> {
  await assertFacilityExists(facilityId);

  if (areaId) {
    await assertAreaBelongsToFacility(areaId, facilityId);
  }
}

export async function listAssets(filter: ActiveFilter): Promise<AssetSummary[]> {
  const assets = await prisma.asset.findMany({
    where: filter,
    orderBy: { name: 'asc' },
  });

  return assets.map(toAssetSummary);
}

export async function listAssetsByArea(
  areaId: string,
  filter: ActiveFilter,
): Promise<AssetSummary[]> {
  await assertAreaExists(areaId);

  const assets = await prisma.asset.findMany({
    where: { areaId, ...filter },
    orderBy: { name: 'asc' },
  });

  return assets.map(toAssetSummary);
}

export async function getAssetById(id: string, filter: ActiveFilter): Promise<AssetSummary> {
  const asset = await prisma.asset.findFirst({
    where: { id, ...filter },
  });

  if (!asset) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Asset not found');
  }

  return toAssetSummary(asset);
}

export async function createAsset(input: CreateAssetInput): Promise<AssetSummary> {
  const areaId = input.areaId ?? null;
  await validateAssetRelationships(input.facilityId, areaId);

  const asset = await prisma.asset.create({
    data: {
      facilityId: input.facilityId,
      areaId,
      name: input.name,
      description: input.description,
      requiresApproval: input.requiresApproval,
      isActive: input.isActive,
    },
  });

  return toAssetSummary(asset);
}

export async function updateAsset(id: string, input: UpdateAssetInput): Promise<AssetSummary> {
  const existing = await prisma.asset.findUnique({ where: { id } });

  if (!existing) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Asset not found');
  }

  const facilityId = input.facilityId ?? existing.facilityId;
  const areaId =
    input.areaId !== undefined ? input.areaId : existing.areaId;

  await validateAssetRelationships(facilityId, areaId);

  const asset = await prisma.asset.update({
    where: { id },
    data: {
      ...input,
      facilityId,
      areaId,
    },
  });

  return toAssetSummary(asset);
}
