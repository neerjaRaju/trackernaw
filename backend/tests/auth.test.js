const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/utils/prisma');

describe('POST /api/v1/auth/register', () => {
  it('creates company + user and returns tokens', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: `reg-${Date.now()}@test.local`,
      password: 'secret123',
      fullName: 'Reg User',
      companyName: 'Acme',
    });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.email).toContain('reg-');
    expect(res.body.user.passwordHash).toBeUndefined(); // must not leak
    expect(res.body.user.role).toBe('COMPANY_ADMIN');
  });

  it('rejects duplicate email', async () => {
    const email = `dup-${Date.now()}@test.local`;
    await request(app).post('/api/v1/auth/register').send({
      email, password: 'secret123', companyName: 'A',
    });
    const res = await request(app).post('/api/v1/auth/register').send({
      email, password: 'secret123', companyName: 'B',
    });
    expect(res.status).toBe(409);
  });

  it('rejects missing fields', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'x@x.x' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auth/login', () => {
  let email;
  beforeAll(async () => {
    email = `login-${Date.now()}@test.local`;
    await request(app).post('/api/v1/auth/register').send({
      email, password: 'secret123', companyName: 'Login Co',
    });
  });

  it('returns tokens on correct password', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email, password: 'secret123',
    });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('401 on wrong password', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email, password: 'wrong',
    });
    expect(res.status).toBe(401);
  });

  it('401 on unknown email', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'nobody@nowhere.test', password: 'whatever',
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
