import { getDb } from '../lib/prisma-tenant';

export async function ensureCompany(id: string, name: string) {
  return getDb().company.upsert({
    where: { id },
    update: { name },
    create: { id, name },
  });
}

/** Remove seeded tenant data before re-inserting demo records. */
export async function clearCompanySeedData(companyId: string): Promise<void> {
  await getDb().accessRequest.deleteMany({ where: { companyId } });
  await getDb().asset.deleteMany({ where: { companyId } });
  await getDb().area.deleteMany({ where: { companyId } });
  await getDb().facility.deleteMany({ where: { companyId } });
}
