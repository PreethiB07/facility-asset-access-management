import { AppError } from '../errors/app.error';
import { ErrorCodes } from '../errors/error-codes';
import { getDb, runWithCompanyContext } from '../lib/prisma-tenant';
import type { ActiveFilter } from '../utils/query.util';
import type { AreaDetail, AreaSummary } from '../types/resource.types';
import { toAreaDetail, toAreaSummary } from '../types/resource.types';
import type { CreateAreaInput, UpdateAreaInput } from '../validators/resource.validators';

async function assertFacilityInCompanyTx(facilityId: string): Promise<void> {
  const facility = await getDb().facility.findFirst({ where: { id: facilityId } });
  if (!facility) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Facility not found');
  }
}

export async function listAreasByFacility(
  facilityId: string,
  filter: ActiveFilter,
  companyId: string,
): Promise<AreaSummary[]> {
  return runWithCompanyContext(companyId, async () => {
    await assertFacilityInCompanyTx(facilityId);

    const areas = await getDb().area.findMany({
      where: { facilityId, ...filter },
      orderBy: { name: 'asc' },
    });

    return areas.map(toAreaSummary);
  });
}

export async function getAreaById(
  id: string,
  filter: ActiveFilter,
  companyId: string,
): Promise<AreaDetail> {
  return runWithCompanyContext(companyId, async () => {
    const area = await getDb().area.findFirst({
      where: { id, ...filter },
    });

    if (!area) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Area not found');
    }

    return toAreaDetail(area);
  });
}

export async function createArea(
  facilityId: string,
  input: CreateAreaInput,
  companyId: string,
): Promise<AreaDetail> {
  return runWithCompanyContext(companyId, async () => {
    await assertFacilityInCompanyTx(facilityId);

    const area = await getDb().area.create({
      data: {
        ...input,
        facilityId,
        companyId,
      },
    });

    return toAreaDetail(area);
  });
}

export async function updateArea(
  id: string,
  input: UpdateAreaInput,
  companyId: string,
): Promise<AreaDetail> {
  return runWithCompanyContext(companyId, async () => {
    const existing = await getDb().area.findFirst({ where: { id } });

    if (!existing) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Area not found');
    }

    const area = await getDb().area.update({
      where: { id },
      data: input,
    });

    return toAreaDetail(area);
  });
}

export async function assertAreaBelongsToFacility(
  areaId: string,
  facilityId: string,
  companyId: string,
): Promise<void> {
  return runWithCompanyContext(companyId, async () => {
    await assertAreaBelongsToFacilityTx(areaId, facilityId);
  });
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

export async function assertAreaInCompany(areaId: string, companyId: string): Promise<void> {
  return runWithCompanyContext(companyId, async () => {
    const area = await getDb().area.findFirst({ where: { id: areaId } });
    if (!area) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Area not found');
    }
  });
}
