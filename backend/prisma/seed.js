const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.upsert({
    where: { subdomain: 'demo' },
    update: {},
    create: { name: 'Demo Co', subdomain: 'demo', plan: 'pro' },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.test' },
    update: {},
    create: {
      email: 'admin@demo.test',
      passwordHash: await bcrypt.hash('admin123', 10),
      fullName: 'Demo Admin',
      role: 'COMPANY_ADMIN',
      companyId: company.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'employee@demo.test' },
    update: {},
    create: {
      email: 'employee@demo.test',
      passwordHash: await bcrypt.hash('emp123', 10),
      fullName: 'Demo Employee',
      role: 'EMPLOYEE',
      companyId: company.id,
      managerId: admin.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'superadmin@system.test' },
    update: {},
    create: {
      email: 'superadmin@system.test',
      passwordHash: await bcrypt.hash('superadmin123', 10),
      fullName: 'System Super Admin',
      role: 'SUPER_ADMIN',
      companyId: company.id,
    },
  });

  await prisma.geofence.upsert({
    where: { id: 'demo-office' },
    update: {},
    create: {
      id: 'demo-office',
      companyId: company.id,
      name: 'HQ Office',
      lat: 28.6139,
      lng: 77.209,
      radiusM: 200,
    },
  });

  console.log('Seeded demo company.');
  console.log('Login as COMPANY_ADMIN: admin@demo.test / admin123');
  console.log('Login as SUPER_ADMIN: superadmin@system.test / superadmin123');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

