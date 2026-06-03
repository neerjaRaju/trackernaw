const prisma = require('../utils/prisma');
const redis = require('../utils/redis');
const { publishLocation } = require('../services/kafkaProducer');
const { detectStops } = require('../services/stopsService');
const { haversineMeters } = require('../services/geofenceService');
const { emitToCompany } = require('../sockets');

exports.update = async (req, res, next) => {
  try {
    const { lat, lng, accuracy, speed, battery, isMoving, isMock, recordedAt } = req.body;
    const userId = req.user.sub;

    // Real-GPS-only: reject mock/spoofed fixes server-side (defense in depth).
    // The SDK already drops them at the source, but a tampered client could
    // still POST one. We refuse to persist or broadcast spoofed coordinates.
    if (isMock === true) {
      return res.status(422).json({ error: 'Mock location rejected', code: 'MOCK_LOCATION' });
    }
    if (typeof lat !== 'number' || typeof lng !== 'number' ||
        lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const ping = {
      userId,
      lat,
      lng,
      accuracy,
      speed,
      battery,
      isMoving: !!isMoving,
      recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
    };

    // Cache last-known for live map
    await redis.set(
      `loc:${userId}`,
      JSON.stringify({ ...ping, companyId: req.user.companyId }),
      'EX',
      300
    );

    // Persist
    await prisma.locationPing.create({ data: ping });

    // Stream to Kafka (Flink consumes downstream)
    publishLocation({ ...ping, companyId: req.user.companyId }).catch(() => {});

    // Live socket update
    emitToCompany(req.user.companyId, 'location:update', { userId, ...ping });

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
};

exports.live = async (req, res, next) => {
  try {
    const stream = redis.scanStream({ match: 'loc:*' });
    const results = [];
    stream.on('data', async (keys) => {
      for (const k of keys) {
        const v = await redis.get(k);
        if (v) {
          const obj = JSON.parse(v);
          if (obj.companyId === req.user.companyId) results.push(obj);
        }
      }
    });
    stream.on('end', () => res.json(results));
    stream.on('error', (e) => next(e));
  } catch (err) {
    next(err);
  }
};

exports.history = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const where = { userId: req.params.userId };
    if (from || to) {
      where.recordedAt = {};
      if (from) where.recordedAt.gte = new Date(from);
      if (to) where.recordedAt.lte = new Date(to);
    }
    const points = await prisma.locationPing.findMany({
      where,
      orderBy: { recordedAt: 'asc' },
      take: 5000,
    });
    res.json(points);
  } catch (err) {
    next(err);
  }
};

// Full route for a user/day: polyline points + computed stops + total distance.
// Query params: ?day=YYYY-MM-DD (defaults to today), ?radiusM, ?minMinutes
exports.route = async (req, res, next) => {
  try {
    const day = req.query.day ? new Date(req.query.day) : new Date();
    day.setHours(0, 0, 0, 0);
    const next = new Date(day.getTime() + 24 * 3600_000);

    // Tenant guard: verify the target user belongs to the caller's company
    const target = await prisma.user.findFirst({
      where: { id: req.params.userId, companyId: req.user.companyId },
      select: { id: true, fullName: true },
    });
    if (!target) return res.status(404).json({ error: 'User not found in this company' });

    const points = await prisma.locationPing.findMany({
      where: { userId: req.params.userId, recordedAt: { gte: day, lt: next } },
      orderBy: { recordedAt: 'asc' },
      select: { lat: true, lng: true, recordedAt: true, speed: true, isMoving: true },
    });

    let distanceM = 0;
    for (let i = 1; i < points.length; i++) {
      distanceM += haversineMeters(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
    }

    const stops = detectStops(points, {
      radiusM: Number(req.query.radiusM) || 80,
      minMinutes: Number(req.query.minMinutes) || 5,
    });

    res.json({
      user: target,
      day: day.toISOString().slice(0, 10),
      points,
      stops,
      distanceKm: +(distanceM / 1000).toFixed(2),
    });
  } catch (e) { next(e); }
};
