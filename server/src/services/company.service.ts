import { DEFAULT_REGISTRATION_COMPANY_NAME } from '../constants/company.constants';
import { AppError } from '../errors/app.error';
import { ErrorCodes } from '../errors/error-codes';
import { getDb, runWithCompanyContext } from '../lib/prisma-tenant';
import type { CompanyDetailsResponse } from '../types/company.types';

export async function getDefaultRegistrationCompanyId(): Promise<string> {
  const company = await getDb().company.findUnique({
    where: { name: DEFAULT_REGISTRATION_COMPANY_NAME },
    select: { id: true },
  });

  if (!company) {
    throw new AppError(
      500,
      ErrorCodes.INTERNAL_ERROR,
      'Default registration company is not configured',
    );
  }

  return company.id;
}

export async function getCompanyIdByName(name: string): Promise<string> {
  const company = await getDb().company.findUnique({
    where: { name },
    select: { id: true },
  });

  if (!company) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, `Company not found: ${name}`);
  }

  return company.id;
}

export async function getCompanyDetails(companyId: string): Promise<CompanyDetailsResponse> {
  return runWithCompanyContext(companyId, async () => {
    const company = await getDb().company.findFirst({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            facilities: true,
          },
        },
      },
    });

    if (!company) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Company not found');
    }

    return {
      id: company.id,
      name: company.name,
      status: 'ACTIVE',
      createdAt: company.createdAt.toISOString(),
      totalUsers: company._count.users,
      totalFacilities: company._count.facilities,
    };
  });
}
