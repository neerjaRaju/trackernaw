const bcrypt = require('bcryptjs');
const prisma = require('../src/utils/prisma');
const redis = require('../src/utils/redis');
const { signAccess } = require('../src/utils/jwt');

// Counter prefixed with timestamp so parallel test files don't collide on emails,
// and so each Jest run starts with fresh-looking identifiers even if cleanup
// missed something.
let counter = Math.floor(Math.random() * 100_000);

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
  const finalEmail = email || `u${counter}-${Date.now()}@test.local`;
  const user = await prisma.user.create({
    data: {
      email: finalEmail,
      fullName: fullName || `User ${counter}`,
      passwordHash: await bcrypt.hash(password, 10),
      role,
      companyId: c.id,
    },
  });
  // Clear any lockout state for this email so prior failing tests don't bleed in.
  await redis.del(`auth:fails:${finalEmail.toLowerCase()}`);
  await redis.del(`auth:lock:${finalEmail.toLowerCase()}`);
  const token = signAccess({ sub: user.id, companyId: user.companyId, role: user.role });
  return { user, company: c, token };
}

async function clearLockout(email) {
  await redis.del(`auth:fails:${email.toLowerCase()}`);
  await redis.del(`auth:lock:${email.toLowerCase()}`);
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = { createCompany, createUser, clearLockout, authHeader };
