import { PrismaClient, Role, AccessType, AccessRequestStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

/** Development/demo accounts — fake challenge-only credentials documented in docs/demo-accounts.md */
const DEMO_ACCOUNTS = [
  {
    email: 'demo.admin@example.com',
    name: 'Demo Admin',
    role: Role.ADMIN,
    password: 'DemoAdmin@123',
  },
  {
    email: 'demo.manager@example.com',
    name: 'Demo Manager',
    role: Role.MANAGER,
    password: 'DemoManager@123',
  },
  {
    email: 'demo.user@example.com',
    name: 'Demo User',
    role: Role.USER,
    password: 'DemoUser@123',
  },
] as const;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function upsertDemoUsers() {
  const users: Record<string, { id: string; email: string }> = {};

  for (const account of DEMO_ACCOUNTS) {
    const passwordHash = await hashPassword(account.password);
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: {
        name: account.name,
        passwordHash,
        role: account.role,
        isActive: true,
      },
      create: {
        name: account.name,
        email: account.email,
        passwordHash,
        role: account.role,
        isActive: true,
      },
    });
    users[account.role] = { id: user.id, email: user.email };
  }

  return {
    admin: users[Role.ADMIN],
    manager: users[Role.MANAGER],
    user: users[Role.USER],
  };
}

async function main() {
  const { admin, manager, user } = await upsertDemoUsers();

  await prisma.accessRequest.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.area.deleteMany();
  await prisma.facility.deleteMany();

  const mainOperations = await prisma.facility.create({
    data: {
      name: 'Main Operations Facility',
      description: 'Primary operations hub with controlled areas and equipment',
      isActive: true,
      requiresApproval: true,
    },
  });

  const productionFacility = await prisma.facility.create({
    data: {
      name: 'Production Facility',
      description: 'Manufacturing and production floor access',
      isActive: true,
      requiresApproval: false,
    },
  });

  const inactiveFacility = await prisma.facility.create({
    data: {
      name: 'Decommissioned Warehouse',
      description: 'Inactive facility retained for historical access records',
      isActive: false,
      requiresApproval: true,
    },
  });

  const serverRoom = await prisma.area.create({
    data: {
      facilityId: mainOperations.id,
      name: 'Server Room',
      description: 'Climate-controlled data center area',
      isActive: true,
      requiresApproval: true,
    },
  });

  const equipmentRoom = await prisma.area.create({
    data: {
      facilityId: mainOperations.id,
      name: 'Equipment Room',
      description: 'Shared tools and maintenance equipment',
      isActive: true,
      requiresApproval: false,
    },
  });

  const productionFloor = await prisma.area.create({
    data: {
      facilityId: productionFacility.id,
      name: 'Production Floor',
      description: 'Active manufacturing workspace',
      isActive: true,
      requiresApproval: false,
    },
  });

  const closedArea = await prisma.area.create({
    data: {
      facilityId: mainOperations.id,
      name: 'Closed Storage',
      description: 'Inactive area for testing inactive-resource scenarios',
      isActive: false,
      requiresApproval: true,
    },
  });

  const generator = await prisma.asset.create({
    data: {
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
      facilityId: productionFacility.id,
      areaId: productionFloor.id,
      name: 'Forklift',
      description: 'Electric forklift for material handling',
      isActive: true,
      requiresApproval: false,
    },
  });

  const securityCamera = await prisma.asset.create({
    data: {
      facilityId: mainOperations.id,
      areaId: serverRoom.id,
      name: 'Security Camera',
      description: 'Networked surveillance camera',
      isActive: true,
      requiresApproval: true,
    },
  });

  const independentAsset = await prisma.asset.create({
    data: {
      facilityId: mainOperations.id,
      areaId: null,
      name: 'Independent Asset',
      description: 'Facility-level asset not assigned to any area',
      isActive: true,
      requiresApproval: true,
    },
  });

  const retiredAsset = await prisma.asset.create({
    data: {
      facilityId: mainOperations.id,
      areaId: equipmentRoom.id,
      name: 'Retired Compressor',
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
        facilityId: mainOperations.id,
        accessType: AccessType.TEMPORARY,
        startAt: now,
        endAt: oneWeekLater,
        reason: 'Temporary facility access for scheduled maintenance',
        status: AccessRequestStatus.PENDING,
      },
      {
        requesterId: user.id,
        areaId: serverRoom.id,
        accessType: AccessType.PERMANENT,
        startAt: now,
        endAt: null,
        reason: 'Permanent server room access for daily operations',
        status: AccessRequestStatus.APPROVED,
        approvedById: manager.id,
        approvedAt: now,
      },
      {
        requesterId: user.id,
        assetId: generator.id,
        accessType: AccessType.TEMPORARY,
        startAt: now,
        endAt: oneWeekLater,
        reason: 'Generator inspection and testing',
        status: AccessRequestStatus.REJECTED,
        approvedById: manager.id,
        approvedAt: now,
        rejectionReason: 'Insufficient justification provided for generator access',
      },
    ],
  });

  console.log('Seed completed successfully.');
  console.log('Demo accounts (development/challenge only):');
  for (const account of DEMO_ACCOUNTS) {
    console.log(`  ${account.role}: ${account.email}`);
  }
  console.log(
    `Facilities: ${mainOperations.name}, ${productionFacility.name}, ${inactiveFacility.name}`,
  );
  console.log(`Areas: ${serverRoom.name}, ${equipmentRoom.name}, ${productionFloor.name}, ${closedArea.name}`);
  console.log(
    `Assets: ${generator.name}, ${forklift.name}, ${securityCamera.name}, ${independentAsset.name}, ${retiredAsset.name}`,
  );
  console.log(`Seeded by admin id: ${admin.id}, manager id: ${manager.id}, user id: ${user.id}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
