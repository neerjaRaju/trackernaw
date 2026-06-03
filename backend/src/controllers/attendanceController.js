const prisma = require('../utils/prisma');
const geofenceService = require('../services/geofenceService');
const faceService = require('../services/faceService');
const webhookService = require('../services/webhookService');
const { emitToCompany } = require('../sockets');

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

exports.checkIn = async (req, res, next) => {
  try {
    const { lat, lng, selfieUrl } = req.body;
    const userId = req.user.sub;
    const date = startOfDay();

    const existing = await prisma.attendance.findUnique({
      where: { userId_date: { userId, date } },
    });
    if (existing && existing.checkInAt) {
      return res.status(409).json({ error: 'Already checked in today' });
    }

    const withinGeofence = await geofenceService.isInsideAnyGeofence(req.user.companyId, lat, lng);

    // Face verification: compare check-in selfie against enrolled reference (user.avatarUrl).
    // Returns verified=true if no enrollment exists OR if AWS Rekognition is not configured
    // (dev stub), otherwise live similarity comparison.
    let faceVerified = false;
    if (selfieUrl) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
      if (user?.avatarUrl) {
        const result = await faceService.compareFaces(user.avatarUrl, selfieUrl);
        faceVerified = result.verified;
        if (!faceVerified && result.mode === 'live') {
          return res.status(422).json({
            error: 'Face does not match enrolled reference',
            code: 'FACE_MISMATCH',
            similarity: result.similarity,
          });
        }
      } else {
        // No enrolled reference yet — allow check-in but flag not verified
        faceVerified = false;
      }
    }

    const att = await prisma.attendance.upsert({
      where: { userId_date: { userId, date } },
      update: {
        checkInAt: new Date(),
        checkInLat: lat,
        checkInLng: lng,
        checkInSelfie: selfieUrl,
        withinGeofence,
        faceVerified,
      },
      create: {
        userId,
        companyId: req.user.companyId,
        date,
        checkInAt: new Date(),
        checkInLat: lat,
        checkInLng: lng,
        checkInSelfie: selfieUrl,
        withinGeofence,
        faceVerified,
      },
    });

    emitToCompany(req.user.companyId, 'attendance:update', att);
    webhookService.emit(req.user.companyId, 'attendance.checked_in', {
      attendanceId: att.id, userId, date: att.date, faceVerified, withinGeofence,
    }).catch(() => {});
    res.status(201).json(att);
  } catch (err) {
    next(err);
  }
};

exports.checkOut = async (req, res, next) => {
  try {
    const { lat, lng, selfieUrl } = req.body;
    const userId = req.user.sub;
    const date = startOfDay();
    const att = await prisma.attendance.findUnique({
      where: { userId_date: { userId, date } },
    });
    if (!att) return res.status(404).json({ error: 'No check-in found for today' });

    const checkOutAt = new Date();
    const workMinutes = Math.floor((checkOutAt - att.checkInAt) / 60000) - (att.breakMinutes || 0);

    const updated = await prisma.attendance.update({
      where: { id: att.id },
      data: {
        checkOutAt,
        checkOutLat: lat,
        checkOutLng: lng,
        checkOutSelfie: selfieUrl,
        workMinutes,
      },
    });
    emitToCompany(req.user.companyId, 'attendance:update', updated);
    webhookService.emit(req.user.companyId, 'attendance.checked_out', {
      attendanceId: updated.id, userId, workMinutes: updated.workMinutes,
    }).catch(() => {});
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

exports.today = async (req, res, next) => {
  try {
    const att = await prisma.attendance.findUnique({
      where: { userId_date: { userId: req.user.sub, date: startOfDay() } },
    });
    res.json(att);
  } catch (err) {
    next(err);
  }
};

exports.history = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const where = { userId: req.user.sub };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }
    const records = await prisma.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 100,
    });
    res.json(records);
  } catch (err) {
    next(err);
  }
};

exports.teamAttendance = async (req, res, next) => {
  try {
    const records = await prisma.attendance.findMany({
      where: { companyId: req.user.companyId, date: startOfDay() },
      include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
    res.json(records);
  } catch (err) {
    next(err);
  }
};
