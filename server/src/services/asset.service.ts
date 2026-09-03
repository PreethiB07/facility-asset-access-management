import { AppError } from '../errors/app.error';
import { ErrorCodes } from '../errors/error-codes';
import { getDb, runWithCompanyContext } from '../lib/prisma-tenant';
import type { ActiveFilter } from '../utils/query.util';
import type { AssetSummary } from '../types/resource.types';
import { toAssetSummary } from '../types/resource.types';
import type { CreateAssetInput, UpdateAssetInput } from '../validators/resource.validators';

async function assertFacilityInCompanyTx(facilityId: string): Promise<void> {
  const facility = await getDb().facility.findFirst({ where: { id: facilityId } });
  if (!facility) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Facility not found');
  }
}

async function assertAreaBelongsToFacilityTx(areaId: string, facilityId: string): Promise<void> {
  const area = await getDb().area.findFirst({ where: { id: areaId } });

  if (!area) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Area not found');
  }

  if (area.facilityId !== facilityId) {
    throw new AppError(
      400,
      ErrorCodes.VALIDATION_ERROR,
      'Area does not belong to the specified facility',
    );
  }
}

async function validateAssetRelationshipsTx(
  facilityId: string,
  areaId: string | null | undefined,
): Promise<void> {
  await assertFacilityInCompanyTx(facilityId);

  if (areaId) {
    await assertAreaBelongsToFacilityTx(areaId, facilityId);
  }
}

export async function listAssets(filter: ActiveFilter, companyId: string): Promise<AssetSummary[]> {
  return runWithCompanyContext(companyId, async () => {
    const assets = await getDb().asset.findMany({
      where: filter,
      orderBy: { name: 'asc' },
    });

    return assets.map(toAssetSummary);
  });
}

export async function listAssetsByArea(
  areaId: string,
  filter: ActiveFilter,
  companyId: string,
): Promise<AssetSummary[]> {
  return runWithCompanyContext(companyId, async () => {
    const area = await getDb().area.findFirst({ where: { id: areaId } });
    if (!area) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Area not found');
    }

    const assets = await getDb().asset.findMany({
      where: { areaId, ...filter },
      orderBy: { name: 'asc' },
    });

    return assets.map(toAssetSummary);
  });
}

export async function getAssetById(
  id: string,
  filter: ActiveFilter,
  companyId: string,
): Promise<AssetSummary> {
  return runWithCompanyContext(companyId, async () => {
    const asset = await getDb().asset.findFirst({
      where: { id, ...filter },
    });

    if (!asset) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Asset not found');
    }

    return toAssetSummary(asset);
  });
}

export async function createAsset(
  input: CreateAssetInput,
  companyId: string,
): Promise<AssetSummary> {
  return runWithCompanyContext(companyId, async () => {
    const areaId = input.areaId ?? null;
    await validateAssetRelationshipsTx(input.facilityId, areaId);

    const asset = await getDb().asset.create({
      data: {
        companyId,
        facilityId: input.facilityId,
        areaId,
        name: input.name,
        description: input.description,
        requiresApproval: input.requiresApproval,
        isActive: input.isActive,
      },
    });

    return toAssetSummary(asset);
  });
}

export async function updateAsset(
  id: string,
  input: UpdateAssetInput,
  companyId: string,
): Promise<AssetSummary> {
  return runWithCompanyContext(companyId, async () => {
    const existing = await getDb().asset.findFirst({ where: { id } });

    if (!existing) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Asset not found');
    }

    const facilityId = input.facilityId ?? existing.facilityId;
    const areaId = input.areaId !== undefined ? input.areaId : existing.areaId;

    await validateAssetRelationshipsTx(facilityId, areaId);

    const asset = await getDb().asset.update({
      where: { id },
      data: {
        ...input,
        facilityId,
        areaId,
      },
    });

    return toAssetSummary(asset);
  });
}
