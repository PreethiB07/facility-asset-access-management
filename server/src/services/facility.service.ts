import { AppError } from '../errors/app.error';
import { ErrorCodes } from '../errors/error-codes';
import { getDb, runWithCompanyContext } from '../lib/prisma-tenant';
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

export async function listFacilities(
  filter: ActiveFilter,
  companyId: string,
): Promise<FacilitySummary[]> {
  return runWithCompanyContext(companyId, async () => {
    const facilities = await getDb().facility.findMany({
      where: filter,
      orderBy: { name: 'asc' },
    });

    return facilities.map(toFacilitySummary);
  });
}

export async function getFacilityById(
  id: string,
  filter: ActiveFilter,
  companyId: string,
): Promise<FacilityDetail> {
  return runWithCompanyContext(companyId, async () => {
    const facility = await getDb().facility.findFirst({
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
  });
}

export async function createFacility(
  input: CreateFacilityInput,
  companyId: string,
): Promise<FacilitySummary> {
  return runWithCompanyContext(companyId, async () => {
    const facility = await getDb().facility.create({
      data: {
        ...input,
        companyId,
      },
    });

    return toFacilitySummary(facility);
  });
}

export async function updateFacility(
  id: string,
  input: UpdateFacilityInput,
  companyId: string,
): Promise<FacilitySummary> {
  return runWithCompanyContext(companyId, async () => {
    const existing = await getDb().facility.findFirst({ where: { id } });

    if (!existing) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Facility not found');
    }

    const facility = await getDb().facility.update({
      where: { id },
      data: input,
    });

    return toFacilitySummary(facility);
  });
}

export async function assertFacilityInCompany(id: string, companyId: string): Promise<void> {
  return runWithCompanyContext(companyId, async () => {
    await assertFacilityInCompanyTx(id);
  });
}

async function assertFacilityInCompanyTx(id: string): Promise<void> {
  const facility = await getDb().facility.findFirst({ where: { id } });
  if (!facility) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Facility not found');
  }
}
