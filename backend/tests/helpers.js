const bcrypt = require('bcryptjs');
const prisma = require('../src/utils/prisma');
const { signAccess } = require('../src/utils/jwt');

let counter = 0;

async function createCompany(overrides = {}) {
  counter++;
  return prisma.company.create({
    data: {
      name: `Test Co ${counter}`,
      subdomain: `test-${counter}-${Date.now()}`,
      ...overrides,
    },
  });
}

async function createUser({ company, email, role = 'EMPLOYEE', fullName, password = 'secret123' } = {}) {
  counter++;
  const c = company || await createCompany();
  const user = await prisma.user.create({
    data: {
      email: email || `user${counter}@test.local`,
      fullName: fullName || `User ${counter}`,
      passwordHash: await bcrypt.hash(password, 10),
      role,
      companyId: c.id,
    },
  });
  const token = signAccess({ sub: user.id, companyId: user.companyId, role: user.role });
  return { user, company: c, token };
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = { createCompany, createUser, authHeader };
