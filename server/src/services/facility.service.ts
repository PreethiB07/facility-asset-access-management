import { AppError } from '../errors/app.error';
import { ErrorCodes } from '../errors/error-codes';
import { prisma } from '../lib/prisma';
import type { ActiveFilter } from '../utils/query.util';
import type {
  CreateFacilityInput,
  UpdateFacilityInput,
} from '../validators/resource.validators';
import {
  toAreaSummary,
  toFacilitySummary,
  type FacilityDetail,
  type FacilitySummary,
} from '../types/resource.types';

export async function listFacilities(filter: ActiveFilter): Promise<FacilitySummary[]> {
  const facilities = await prisma.facility.findMany({
    where: filter,
    orderBy: { name: 'asc' },
  });

  return facilities.map(toFacilitySummary);
}

export async function getFacilityById(
  id: string,
  filter: ActiveFilter,
): Promise<FacilityDetail> {
  const facility = await prisma.facility.findFirst({
    where: { id, ...filter },
    include: {
      areas: {
        where: filter,
        orderBy: { name: 'asc' },
      },
    },
  });

  if (!facility) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Facility not found');
  }

  return {
    ...toFacilitySummary(facility),
    areas: facility.areas.map(toAreaSummary),
  };
}

export async function createFacility(
  input: CreateFacilityInput,
  companyId: string,
): Promise<FacilitySummary> {
  const facility = await prisma.facility.create({
    data: {
      ...input,
      companyId,
    },
  });

  return toFacilitySummary(facility);
}

export async function updateFacility(
  id: string,
  input: UpdateFacilityInput,
): Promise<FacilitySummary> {
  const existing = await prisma.facility.findUnique({ where: { id } });

  if (!existing) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Facility not found');
  }

  const facility = await prisma.facility.update({
    where: { id },
    data: input,
  });

  return toFacilitySummary(facility);
}

export async function assertFacilityExists(id: string): Promise<void> {
  const facility = await prisma.facility.findUnique({ where: { id } });
  if (!facility) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Facility not found');
  }
}
