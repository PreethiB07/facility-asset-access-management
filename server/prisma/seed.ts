import { PrismaClient, Role, AccessType, AccessRequestStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import {
  ACME_CORPORATION_NAME,
  GLOBEX_INDUSTRIES_NAME,
  LEGACY_COMPANY_ID,
} from '../src/constants/company.constants';
import { clearCompanySeedData, ensureCompany } from '../src/utils/company-seed';
import { upsertUserByCompanyEmail } from '../src/utils/user-repository';

dotenv.config();

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

const GLOBEX_COMPANY_ID = '00000000-0000-4000-8000-000000000002';

interface DemoAccount {
  email: string;
  name: string;
  role: Role;
  password: string;
}

const ACME_ACCOUNTS: DemoAccount[] = [
  { email: 'demo.admin@example.com', name: 'Demo Admin', role: Role.ADMIN, password: 'DemoAdmin@123' },
  { email: 'demo.manager@example.com', name: 'Demo Manager', role: Role.MANAGER, password: 'DemoManager@123' },
  { email: 'demo.user@example.com', name: 'Demo User', role: Role.USER, password: 'DemoUser@123' },
];

const GLOBEX_ACCOUNTS: DemoAccount[] = [
  { email: 'globex.admin@example.com', name: 'Globex Admin', role: Role.ADMIN, password: 'GlobexAdmin@123' },
  { email: 'globex.manager@example.com', name: 'Globex Manager', role: Role.MANAGER, password: 'GlobexManager@123' },
  { email: 'globex.user@example.com', name: 'Globex User', role: Role.USER, password: 'GlobexUser@123' },
];

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function upsertCompany(id: string, name: string) {
  return ensureCompany(id, name);
}

async function upsertDemoUsers(companyId: string, accounts: DemoAccount[]) {
  const users: Record<string, { id: string; email: string }> = {};

  for (const account of accounts) {
    const passwordHash = await hashPassword(account.password);
    const user = await upsertUserByCompanyEmail({
      companyId,
      email: account.email,
      name: account.name,
      passwordHash,
      role: account.role,
      isActive: true,
    });
    users[account.role] = { id: user.id, email: user.email };
  }

  return {
    admin: users[Role.ADMIN],
    manager: users[Role.MANAGER],
    user: users[Role.USER],
  };
}

async function seedCompanyData(
  companyId: string,
  prefix: string,
  user: { id: string; email: string },
  manager: { id: string; email: string },
) {
  await clearCompanySeedData(companyId);

  const mainOperations = await prisma.facility.create({
    data: {
      companyId,
      name: `${prefix} Main Operations Facility`,
      description: 'Primary operations hub with controlled areas and equipment',
      isActive: true,
      requiresApproval: true,
    },
  });

  const productionFacility = await prisma.facility.create({
    data: {
      companyId,
      name: `${prefix} Production Facility`,
      description: 'Manufacturing and production floor access',
      isActive: true,
      requiresApproval: false,
    },
  });

  const inactiveFacility = await prisma.facility.create({
    data: {
      companyId,
      name: `${prefix} Decommissioned Warehouse`,
      description: 'Inactive facility retained for historical access records',
      isActive: false,
      requiresApproval: true,
    },
  });

  const serverRoom = await prisma.area.create({
    data: {
      companyId,
      facilityId: mainOperations.id,
      name: 'Server Room',
      description: 'Climate-controlled data center area',
      isActive: true,
      requiresApproval: true,
    },
  });

  const equipmentRoom = await prisma.area.create({
    data: {
      companyId,
      facilityId: mainOperations.id,
      name: 'Equipment Room',
      description: 'Shared tools and maintenance equipment',
      isActive: true,
      requiresApproval: false,
    },
  });

  const productionFloor = await prisma.area.create({
    data: {
      companyId,
      facilityId: productionFacility.id,
      name: 'Production Floor',
      description: 'Active manufacturing workspace',
      isActive: true,
      requiresApproval: false,
    },
  });

  const generator = await prisma.asset.create({
    data: {
      companyId,
      facilityId: mainOperations.id,
      areaId: equipmentRoom.id,
      name: 'Generator',
      description: 'Backup power generator',
      isActive: true,
      requiresApproval: true,
    },
  });

  const forklift = await prisma.asset.create({
    data: {
      companyId,
      facilityId: productionFacility.id,
      areaId: productionFloor.id,
      name: 'Forklift',
      description: 'Electric forklift for material handling',
      isActive: true,
      requiresApproval: false,
    },
  });

  const independentAsset = await prisma.asset.create({
    data: {
      companyId,
      facilityId: mainOperations.id,
      areaId: null,
      name: 'Independent Asset',
      description: 'Facility-level asset not assigned to any area',
      isActive: true,
      requiresApproval: true,
    },
  });

  const now = new Date();
  const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await prisma.accessRequest.createMany({
    data: [
      {
        companyId,
        requesterId: user.id,
        facilityId: mainOperations.id,
        accessType: AccessType.TEMPORARY,
        startAt: now,
        endAt: oneWeekLater,
        reason: `${prefix} temporary facility access for scheduled maintenance`,
        status: AccessRequestStatus.PENDING,
      },
      {
        companyId,
        requesterId: user.id,
        areaId: serverRoom.id,
        accessType: AccessType.PERMANENT,
        startAt: now,
        endAt: null,
        reason: `${prefix} permanent server room access for daily operations`,
        status: AccessRequestStatus.APPROVED,
        approvedById: manager.id,
        approvedAt: now,
      },
      {
        companyId,
        requesterId: user.id,
        assetId: generator.id,
        accessType: AccessType.TEMPORARY,
        startAt: now,
        endAt: oneWeekLater,
        reason: `${prefix} generator inspection and testing`,
        status: AccessRequestStatus.REJECTED,
        approvedById: manager.id,
        approvedAt: now,
        rejectionReason: 'Insufficient justification provided for generator access',
      },
    ],
  });

  return {
    facilities: [mainOperations.name, productionFacility.name, inactiveFacility.name],
    areas: [serverRoom.name, equipmentRoom.name, productionFloor.name],
    assets: [generator.name, forklift.name, independentAsset.name],
  };
}

async function main() {
  const acme = await upsertCompany(LEGACY_COMPANY_ID, ACME_CORPORATION_NAME);
  const globex = await upsertCompany(GLOBEX_COMPANY_ID, GLOBEX_INDUSTRIES_NAME);

  const acmeUsers = await upsertDemoUsers(acme.id, ACME_ACCOUNTS);
  const globexUsers = await upsertDemoUsers(globex.id, GLOBEX_ACCOUNTS);

  const acmeData = await seedCompanyData(acme.id, 'Acme', acmeUsers.user, acmeUsers.manager);
  const globexData = await seedCompanyData(globex.id, 'Globex', globexUsers.user, globexUsers.manager);

  console.log('Seed completed successfully.');
  console.log('');
  console.log(`Company A: ${ACME_CORPORATION_NAME} (${acme.id})`);
  for (const account of ACME_ACCOUNTS) {
    console.log(`  ${account.role}: ${account.email}`);
  }
  console.log(`  Facilities: ${acmeData.facilities.join(', ')}`);
  console.log('');
  console.log(`Company B: ${GLOBEX_INDUSTRIES_NAME} (${globex.id})`);
  for (const account of GLOBEX_ACCOUNTS) {
    console.log(`  ${account.role}: ${account.email}`);
  }
  console.log(`  Facilities: ${globexData.facilities.join(', ')}`);
  console.log('');
  console.log('DEVELOPMENT / CHALLENGE ONLY — see docs/demo-accounts.md');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
