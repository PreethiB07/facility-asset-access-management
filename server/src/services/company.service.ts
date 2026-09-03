import { DEFAULT_REGISTRATION_COMPANY_NAME } from '../constants/company.constants';
import { AppError } from '../errors/app.error';
import { ErrorCodes } from '../errors/error-codes';
import { prisma } from '../lib/prisma';

export async function getDefaultRegistrationCompanyId(): Promise<string> {
  const company = await prisma.company.findUnique({
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
  const company = await prisma.company.findUnique({
    where: { name },
    select: { id: true },
  });

  if (!company) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, `Company not found: ${name}`);
  }

  return company.id;
}
