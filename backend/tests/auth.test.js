const request = require('supertest');
const app = require('../src/app');
const { clearLockout } = require('./helpers');

// Per-test unique email so order-dependent state (locks, audit rows) can't
// bleed across cases.
function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}@test.local`;
}

describe('POST /api/v1/auth/register', () => {
  it('creates company + user and returns tokens', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: uniqueEmail('reg'),
      password: 'secret123',
      fullName: 'Reg User',
      companyName: 'Acme',
    });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.role).toBe('COMPANY_ADMIN');
  });

  it('rejects duplicate email', async () => {
    const email = uniqueEmail('dup');
    const first = await request(app).post('/api/v1/auth/register').send({
      email, password: 'secret123', companyName: 'A',
    });
    expect(first.status).toBe(201);
    const res = await request(app).post('/api/v1/auth/register').send({
      email, password: 'secret123', companyName: 'B',
    });
    expect(res.status).toBe(409);
  });

  it('rejects missing fields', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'x@x.x' });
    expect(res.status).toBe(400);
  });

  it('rejects weak passwords', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: uniqueEmail('weak'),
      password: 'short',
      companyName: 'Weak Co',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least 8/i);
  });
});

describe('POST /api/v1/auth/login', () => {
  let email;
  beforeAll(async () => {
    email = uniqueEmail('login');
    await request(app).post('/api/v1/auth/register').send({
      email, password: 'secret123', companyName: 'Login Co',
    });
    await clearLockout(email);
  });

  it('returns tokens on correct password', async () => {
    await clearLockout(email);
    const res = await request(app).post('/api/v1/auth/login').send({
      email, password: 'secret123',
    });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('401 on wrong password', async () => {
    await clearLockout(email);
    const res = await request(app).post('/api/v1/auth/login').send({
      email, password: 'wrong-password-x',
    });
    expect(res.status).toBe(401);
  });

  it('401 on unknown email', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: uniqueEmail('nobody'), password: 'whatever',
    });
    expect(res.status).toBe(401);
  });
});

describe('protected routes', () => {
  it('rejects requests without Authorization header', async () => {
    const res = await request(app).get('/api/v1/attendance/today');
    expect(res.status).toBe(401);
  });

  it('rejects requests with garbage token', async () => {
    const res = await request(app)
      .get('/api/v1/attendance/today')
      .set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });
});
