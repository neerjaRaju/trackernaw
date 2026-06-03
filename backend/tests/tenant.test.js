const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { createUser, authHeader } = require('./helpers');
const prisma = require('../src/utils/prisma');

// Forge a JWT that's well-signed but missing companyId — simulates a
// degenerate token reaching the API (e.g. a buggy SSO flow). Routes must
// reject these with 401, never silently return all-tenant data.
function tokenWithoutTenant(sub = 'ghost-user', role = 'COMPANY_ADMIN') {
  return jwt.sign({ sub, role }, process.env.JWT_SECRET, { expiresIn: '5m' });
}

describe('multi-tenant isolation', () => {
  it('a user in company A cannot see data from company B', async () => {
    const a = await createUser({ role: 'COMPANY_ADMIN' });
    const b = await createUser({ role: 'COMPANY_ADMIN' });

    // Create geofences in each company
    await prisma.geofence.create({ data: {
      companyId: a.company.id, name: 'A office', lat: 1, lng: 1, radiusM: 100,
    }});
    await prisma.geofence.create({ data: {
      companyId: b.company.id, name: 'B office', lat: 2, lng: 2, radiusM: 100,
    }});

    const resA = await request(app).get('/api/v1/geofences').set(authHeader(a.token));
    const resB = await request(app).get('/api/v1/geofences').set(authHeader(b.token));
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(resA.body.every((g) => g.companyId === a.company.id)).toBe(true);
    expect(resB.body.every((g) => g.companyId === b.company.id)).toBe(true);
    expect(resA.body.find((g) => g.name === 'B office')).toBeUndefined();
    expect(resB.body.find((g) => g.name === 'A office')).toBeUndefined();
  });

  it('messages cannot be sent across company boundaries', async () => {
    const a = await createUser();
    const b = await createUser(); // different company
    const res = await request(app).post('/api/v1/messages')
      .set(authHeader(a.token))
      .send({ recipientId: b.user.id, body: 'hello' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found in this company/i);
  });

  it('teammates listing only includes same-company peers', async () => {
    const a = await createUser({ role: 'COMPANY_ADMIN' });
    await createUser({ company: a.company });            // same company
    await createUser();                                   // different company
    const res = await request(app).get('/api/v1/users/teammates').set(authHeader(a.token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1); // only the same-company peer
  });

  // --- Regression tests for the requireTenant guard ---
  // A signed but tenant-less JWT must NOT be able to read across companies.
  it('geofences endpoint rejects tokens without companyId', async () => {
    const token = tokenWithoutTenant();
    const res = await request(app).get('/api/v1/geofences').set(authHeader(token));
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_TENANT');
  });

  it('webhooks endpoint rejects tokens without companyId', async () => {
    const token = tokenWithoutTenant();
    const res = await request(app).get('/api/v1/webhooks').set(authHeader(token));
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_TENANT');
  });

  it('audit endpoint rejects tokens without companyId', async () => {
    const token = tokenWithoutTenant();
    const res = await request(app).get('/api/v1/audit').set(authHeader(token));
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_TENANT');
  });

  // Body-supplied companyId must never override the JWT.
  it('webhooks POST ignores companyId in the request body', async () => {
    const a = await createUser({ role: 'COMPANY_ADMIN' });
    const victim = await createUser({ role: 'COMPANY_ADMIN' });
    const res = await request(app).post('/api/v1/webhooks')
      .set(authHeader(a.token))
      .send({
        name: 'malicious', url: 'https://attacker.test',
        events: ['sos.triggered'],
        companyId: victim.company.id, // attempt to plant in victim's tenant
      });
    expect(res.status).toBe(201);
    expect(res.body.companyId).toBe(a.company.id);   // landed in attacker's own tenant
    expect(res.body.companyId).not.toBe(victim.company.id);
  });

  it('geofences POST ignores companyId in the request body', async () => {
    const a = await createUser({ role: 'COMPANY_ADMIN' });
    const victim = await createUser({ role: 'COMPANY_ADMIN' });
    const res = await request(app).post('/api/v1/geofences')
      .set(authHeader(a.token))
      .send({
        name: 'evil HQ', lat: 1, lng: 1, radiusM: 100,
        companyId: victim.company.id,
      });
    expect(res.status).toBe(201);
    expect(res.body.companyId).toBe(a.company.id);
    expect(res.body.companyId).not.toBe(victim.company.id);
  });
});

describe('RBAC enforcement', () => {
  it('EMPLOYEE cannot list all users', async () => {
    const e = await createUser({ role: 'EMPLOYEE' });
    const res = await request(app).get('/api/v1/users').set(authHeader(e.token));
    expect(res.status).toBe(403);
  });

  it('EMPLOYEE cannot approve expenses', async () => {
    const e = await createUser({ role: 'EMPLOYEE' });
    const exp = await prisma.expense.create({ data: {
      companyId: e.company.id, userId: e.user.id, category: 'travel', amount: 100, status: 'SUBMITTED',
    }});
    const res = await request(app).post(`/api/v1/expenses/${exp.id}/approve`).set(authHeader(e.token));
    expect(res.status).toBe(403);
  });

  it('COMPANY_ADMIN can approve expenses', async () => {
    const admin = await createUser({ role: 'COMPANY_ADMIN' });
    const emp = await createUser({ company: admin.company, role: 'EMPLOYEE' });
    const exp = await prisma.expense.create({ data: {
      companyId: admin.company.id, userId: emp.user.id, category: 'travel', amount: 100, status: 'SUBMITTED',
    }});
    const res = await request(app).post(`/api/v1/expenses/${exp.id}/approve`).set(authHeader(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');
  });
});
