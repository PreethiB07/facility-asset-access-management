import { prisma } from '../lib/prisma';

export async function ensureCompany(id: string, name: string) {
  return prisma.company.upsert({
    where: { id },
    update: { name },
    create: { id, name },
  });
}

/** Remove seeded tenant data before re-inserting demo records. */
export async function clearCompanySeedData(companyId: string): Promise<void> {
  await prisma.accessRequest.deleteMany({ where: { companyId } });
  await prisma.asset.deleteMany({ where: { companyId } });
  await prisma.area.deleteMany({ where: { companyId } });
  await prisma.facility.deleteMany({ where: { companyId } });
}
