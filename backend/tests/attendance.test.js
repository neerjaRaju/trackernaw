const request = require('supertest');
const app = require('../src/app');
const { createUser, authHeader } = require('./helpers');
const prisma = require('../src/utils/prisma');

describe('POST /api/v1/attendance/checkin', () => {
  it('creates an attendance record with lat/lng', async () => {
    const { token, user } = await createUser();
    const res = await request(app).post('/api/v1/attendance/checkin')
      .set(authHeader(token))
      .send({ lat: 28.6139, lng: 77.209 });
    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(user.id);
    expect(res.body.checkInAt).toBeTruthy();
  });

  it('flags withinGeofence when checkin is inside an office fence', async () => {
    const { token, company } = await createUser();
    await prisma.geofence.create({ data: {
      companyId: company.id, name: 'HQ', lat: 28.6139, lng: 77.209, radiusM: 500,
    }});
    const res = await request(app).post('/api/v1/attendance/checkin')
      .set(authHeader(token))
      .send({ lat: 28.6140, lng: 77.2091 });
    expect(res.status).toBe(201);
    expect(res.body.withinGeofence).toBe(true);
  });

  it('flags withinGeofence=false when far from any fence', async () => {
    const { token, company } = await createUser();
    await prisma.geofence.create({ data: {
      companyId: company.id, name: 'HQ', lat: 28.6, lng: 77.2, radiusM: 100,
    }});
    const res = await request(app).post('/api/v1/attendance/checkin')
      .set(authHeader(token))
      .send({ lat: 19.0, lng: 72.8 });    // Mumbai, far from Delhi fence
    expect(res.status).toBe(201);
    expect(res.body.withinGeofence).toBe(false);
  });

  it('refuses a second checkin in the same day', async () => {
    const { token } = await createUser();
    await request(app).post('/api/v1/attendance/checkin').set(authHeader(token))
      .send({ lat: 28.6, lng: 77.2 });
    const res = await request(app).post('/api/v1/attendance/checkin').set(authHeader(token))
      .send({ lat: 28.6, lng: 77.2 });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/v1/attendance/checkout', () => {
  it('computes work minutes from checkin to checkout', async () => {
    const { token } = await createUser();
    await request(app).post('/api/v1/attendance/checkin').set(authHeader(token))
      .send({ lat: 28.6, lng: 77.2 });
    // Force checkInAt to 1 hour ago
    const today = new Date(); today.setHours(0, 0, 0, 0);
    await prisma.attendance.updateMany({
      where: { date: today },
      data: { checkInAt: new Date(Date.now() - 60 * 60_000) },
    });
    const res = await request(app).post('/api/v1/attendance/checkout').set(authHeader(token))
      .send({ lat: 28.6, lng: 77.2 });
    expect(res.status).toBe(200);
    expect(res.body.workMinutes).toBeGreaterThan(55);
    expect(res.body.workMinutes).toBeLessThan(65);
  });

  it('404 if user never checked in today', async () => {
    const { token } = await createUser();
    const res = await request(app).post('/api/v1/attendance/checkout').set(authHeader(token))
      .send({ lat: 28.6, lng: 77.2 });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/attendance/today', () => {
  it('returns null before any checkin', async () => {
    const { token } = await createUser();
    const res = await request(app).get('/api/v1/attendance/today').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});
