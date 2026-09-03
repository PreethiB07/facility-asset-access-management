import { PrismaClient, Role, AccessType, AccessRequestStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function main() {
  const [adminHash, managerHash, userHash] = await Promise.all([
    hashPassword(requireEnv('SEED_ADMIN_PASSWORD')),
    hashPassword(requireEnv('SEED_MANAGER_PASSWORD')),
    hashPassword(requireEnv('SEED_USER_PASSWORD')),
  ]);

  await prisma.accessRequest.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.area.deleteMany();
  await prisma.facility.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      name: 'System Admin',
      email: 'admin@example.com',
      passwordHash: adminHash,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  const manager = await prisma.user.create({
    data: {
      name: 'Facility Manager',
      email: 'manager@example.com',
      passwordHash: managerHash,
      role: Role.MANAGER,
      isActive: true,
    },
  });

  const user = await prisma.user.create({
    data: {
      name: 'Normal User',
      email: 'user@example.com',
      passwordHash: userHash,
      role: Role.USER,
      isActive: true,
    },
  });

  const activeFacility = await prisma.facility.create({
    data: {
      name: 'Main Campus',
      description: 'Primary facility with multiple areas and assets',
      isActive: true,
      requiresApproval: true,
    },
  });

  const autoApproveFacility = await prisma.facility.create({
    data: {
      name: 'Open Access Building',
      description: 'Facility with auto-approved access requests',
      isActive: true,
      requiresApproval: false,
    },
  });

  const inactiveFacility = await prisma.facility.create({
    data: {
      name: 'Decommissioned Warehouse',
      description: 'Inactive facility for testing inactive-resource scenarios',
      isActive: false,
      requiresApproval: true,
    },
  });

  const area1 = await prisma.area.create({
    data: {
      facilityId: activeFacility.id,
      name: 'Area 1',
      description: 'First area in Main Campus',
      isActive: true,
      requiresApproval: true,
    },
  });

  const area2 = await prisma.area.create({
    data: {
      facilityId: activeFacility.id,
      name: 'Area 2',
      description: 'Second area in Main Campus',
      isActive: true,
      requiresApproval: false,
    },
  });

  const inactiveArea = await prisma.area.create({
    data: {
      facilityId: activeFacility.id,
      name: 'Closed Area',
      description: 'Inactive area for testing',
      isActive: false,
      requiresApproval: true,
    },
  });

  const asset1 = await prisma.asset.create({
    data: {
      facilityId: activeFacility.id,
      areaId: area1.id,
      name: 'Asset 1',
      description: 'Equipment in Area 1',
      isActive: true,
      requiresApproval: true,
    },
  });

  const asset2 = await prisma.asset.create({
    data: {
      facilityId: activeFacility.id,
      areaId: area1.id,
      name: 'Asset 2',
      description: 'Secondary equipment in Area 1',
      isActive: true,
      requiresApproval: false,
    },
  });

  const asset3 = await prisma.asset.create({
    data: {
      facilityId: activeFacility.id,
      areaId: area2.id,
      name: 'Asset 3',
      description: 'Equipment in Area 2',
      isActive: true,
      requiresApproval: true,
    },
  });

  const independentAsset = await prisma.asset.create({
    data: {
      facilityId: activeFacility.id,
      areaId: null,
      name: 'Independent Asset',
      description: 'Asset assigned directly to facility without an area',
      isActive: true,
      requiresApproval: true,
    },
  });

  const inactiveAsset = await prisma.asset.create({
    data: {
      facilityId: activeFacility.id,
      areaId: area2.id,
      name: 'Retired Asset',
      description: 'Inactive asset for testing',
      isActive: false,
      requiresApproval: true,
    },
  });

  const now = new Date();
  const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await prisma.accessRequest.createMany({
    data: [
      {
        requesterId: user.id,
        facilityId: activeFacility.id,
        accessType: AccessType.TEMPORARY,
        startAt: now,
        endAt: oneWeekLater,
        reason: 'Temporary facility access for project work',
        status: AccessRequestStatus.PENDING,
      },
      {
        requesterId: user.id,
        areaId: area1.id,
        accessType: AccessType.PERMANENT,
        startAt: now,
        endAt: null,
        reason: 'Permanent area access for daily operations',
        status: AccessRequestStatus.APPROVED,
        approvedById: manager.id,
        approvedAt: now,
      },
      {
        requesterId: user.id,
        assetId: asset1.id,
        accessType: AccessType.TEMPORARY,
        startAt: now,
        endAt: oneWeekLater,
        reason: 'Temporary asset access for maintenance',
        status: AccessRequestStatus.REJECTED,
        approvedById: manager.id,
        approvedAt: now,
        rejectionReason: 'Insufficient justification provided',
      },
    ],
  });

  console.log('Seed completed successfully.');
  console.log(`Users: admin (${admin.email}), manager (${manager.email}), user (${user.email})`);
  console.log(
    `Facilities: ${activeFacility.name}, ${autoApproveFacility.name}, ${inactiveFacility.name}`,
  );
  console.log(`Areas: ${area1.name}, ${area2.name}, ${inactiveArea.name}`);
  console.log(
    `Assets: ${asset1.name}, ${asset2.name}, ${asset3.name}, ${independentAsset.name}, ${inactiveAsset.name}`,
  );
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
