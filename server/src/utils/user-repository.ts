import type { Prisma, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';

interface UpsertUserInput {
  companyId: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  isActive?: boolean;
}

/** Lookup by tenant + email without relying on generated compound-unique input types. */
export async function findUserByCompanyEmail(companyId: string, email: string) {
  return prisma.user.findFirst({
    where: {
      companyId,
      email: email.toLowerCase(),
    },
  });
}

export async function upsertUserByCompanyEmail(input: UpsertUserInput) {
  const email = input.email.toLowerCase();
  const existing = await findUserByCompanyEmail(input.companyId, email);

  const data: Prisma.UserCreateInput = {
    company: { connect: { id: input.companyId } },
    name: input.name,
    email,
    passwordHash: input.passwordHash,
    role: input.role,
    isActive: input.isActive ?? true,
  };

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        passwordHash: input.passwordHash,
        role: input.role,
        isActive: input.isActive ?? true,
      },
    });
  }

  return prisma.user.create({ data });
}
