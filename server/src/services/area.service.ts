import { AppError } from '../errors/app.error';
import { ErrorCodes } from '../errors/error-codes';
import { prisma } from '../lib/prisma';
import type { ActiveFilter } from '../utils/query.util';
import type { AreaDetail, AreaSummary } from '../types/resource.types';
import { toAreaDetail, toAreaSummary } from '../types/resource.types';
import type { CreateAreaInput, UpdateAreaInput } from '../validators/resource.validators';
import { assertFacilityExists } from './facility.service';

export async function listAreasByFacility(
  facilityId: string,
  filter: ActiveFilter,
): Promise<AreaSummary[]> {
  await assertFacilityExists(facilityId);

  const areas = await prisma.area.findMany({
    where: { facilityId, ...filter },
    orderBy: { name: 'asc' },
  });

  return areas.map(toAreaSummary);
}

export async function getAreaById(id: string, filter: ActiveFilter): Promise<AreaDetail> {
  const area = await prisma.area.findFirst({
    where: { id, ...filter },
  });

  if (!area) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Area not found');
  }

  return toAreaDetail(area);
}

export async function createArea(
  facilityId: string,
  input: CreateAreaInput,
): Promise<AreaDetail> {
  await assertFacilityExists(facilityId);

  const area = await prisma.area.create({
    data: {
      ...input,
      facilityId,
    },
  });

  return toAreaDetail(area);
}

export async function updateArea(id: string, input: UpdateAreaInput): Promise<AreaDetail> {
  const existing = await prisma.area.findUnique({ where: { id } });

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
): Promise<void> {
  const area = await prisma.area.findUnique({ where: { id: areaId } });

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

export async function assertAreaExists(areaId: string): Promise<void> {
  const area = await prisma.area.findUnique({ where: { id: areaId } });
  if (!area) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Area not found');
  }
}
