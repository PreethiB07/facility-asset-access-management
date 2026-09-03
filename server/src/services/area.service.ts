import { AppError } from '../errors/app.error';
import { ErrorCodes } from '../errors/error-codes';
import { prisma } from '../lib/prisma';
import type { ActiveFilter } from '../utils/query.util';
import type { AreaDetail, AreaSummary } from '../types/resource.types';
import { toAreaDetail, toAreaSummary } from '../types/resource.types';
import type { CreateAreaInput, UpdateAreaInput } from '../validators/resource.validators';
import { assertFacilityInCompany } from './facility.service';

export async function listAreasByFacility(
  facilityId: string,
  filter: ActiveFilter,
  companyId: string,
): Promise<AreaSummary[]> {
  await assertFacilityInCompany(facilityId, companyId);

  const areas = await prisma.area.findMany({
    where: { facilityId, companyId, ...filter },
    orderBy: { name: 'asc' },
  });

  return areas.map(toAreaSummary);
}

export async function getAreaById(
  id: string,
  filter: ActiveFilter,
  companyId: string,
): Promise<AreaDetail> {
  const area = await prisma.area.findFirst({
    where: { id, companyId, ...filter },
  });

  if (!area) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Area not found');
  }

  return toAreaDetail(area);
}

export async function createArea(
  facilityId: string,
  input: CreateAreaInput,
  companyId: string,
): Promise<AreaDetail> {
  await assertFacilityInCompany(facilityId, companyId);

  const area = await prisma.area.create({
    data: {
      ...input,
      facilityId,
      companyId,
    },
  });

  return toAreaDetail(area);
}

export async function updateArea(
  id: string,
  input: UpdateAreaInput,
  companyId: string,
): Promise<AreaDetail> {
  const existing = await prisma.area.findFirst({ where: { id, companyId } });

  if (!existing) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Area not found');
  }

  const area = await prisma.area.update({
    where: { id },
    data: input,
  });

  return toAreaDetail(area);
}

export async function assertAreaBelongsToFacility(
  areaId: string,
  facilityId: string,
  companyId: string,
): Promise<void> {
  const area = await prisma.area.findFirst({ where: { id: areaId, companyId } });

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
  const area = await prisma.area.findFirst({ where: { id: areaId, companyId } });
  if (!area) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Area not found');
  }
}
