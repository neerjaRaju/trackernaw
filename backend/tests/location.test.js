const request = require('supertest');
const app = require('../src/app');
const { createUser, authHeader } = require('./helpers');
const { detectStops } = require('../src/services/stopsService');
const { haversineMeters } = require('../src/services/geofenceService');

describe('POST /api/v1/location/update', () => {
  it('persists a valid ping', async () => {
    const { token } = await createUser();
    const res = await request(app).post('/api/v1/location/update')
      .set(authHeader(token))
      .send({ lat: 28.6139, lng: 77.209, accuracy: 8, isMoving: true });
    expect(res.status).toBe(201);
  });

  it('rejects mocked location with 422 MOCK_LOCATION', async () => {
    const { token } = await createUser();
    const res = await request(app).post('/api/v1/location/update')
      .set(authHeader(token))
      .send({ lat: 28.6, lng: 77.2, isMock: true });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('MOCK_LOCATION');
  });

  it('rejects out-of-range coordinates', async () => {
    const { token } = await createUser();
    const res = await request(app).post('/api/v1/location/update')
      .set(authHeader(token))
      .send({ lat: 200, lng: 999 });
    expect(res.status).toBe(400);
  });
});

describe('haversineMeters', () => {
  it('returns 0 for same point', () => {
    expect(haversineMeters(28.6, 77.2, 28.6, 77.2)).toBeCloseTo(0, 0);
  });
  it('returns roughly 111 km per degree of latitude', () => {
    const d = haversineMeters(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(112000);
  });
  it('symmetric', () => {
    const a = haversineMeters(28.6, 77.2, 19.0, 72.8);
    const b = haversineMeters(19.0, 72.8, 28.6, 77.2);
    expect(a).toBeCloseTo(b, 1);
  });
});

describe('detectStops', () => {
  function ping(lat, lng, minOffset) {
    return { lat, lng, recordedAt: new Date(Date.now() + minOffset * 60_000) };
  }

  it('flags a cluster of pings ≥ minMinutes as a stop', () => {
    const pings = [
      ping(28.6139, 77.2090, 0),
      ping(28.6140, 77.2091, 2),
      ping(28.6139, 77.2089, 6),
      ping(28.6141, 77.2092, 10),
    ];
    const stops = detectStops(pings, { radiusM: 50, minMinutes: 5 });
    expect(stops).toHaveLength(1);
    expect(stops[0].durationMin).toBeGreaterThanOrEqual(5);
  });

  it('ignores brief stops below threshold', () => {
    const pings = [
      ping(28.6, 77.2, 0),
      ping(28.6, 77.2, 1),
    ];
    expect(detectStops(pings, { radiusM: 50, minMinutes: 5 })).toHaveLength(0);
  });

  it('separates two distant clusters', () => {
    const pings = [
      ping(28.6, 77.2, 0),
      ping(28.6, 77.2, 6),
      ping(19.0, 72.8, 7),   // ~1100km away
      ping(19.0, 72.8, 13),
    ];
    expect(detectStops(pings, { radiusM: 100, minMinutes: 5 })).toHaveLength(2);
  });
});
