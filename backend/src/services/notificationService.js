const admin = require('firebase-admin');
const logger = require('../utils/logger');
const prisma = require('../utils/prisma');

let initialized = false;

function init() {
  if (initialized) return;
  if (!process.env.FIREBASE_PROJECT_ID) return;
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    });
    initialized = true;
  } catch (e) {
    logger.error('Firebase init failed', e);
  }
}

async function pushToUser(userId, { title, body, data = {}, type = 'system' }) {
  init();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const notif = await prisma.notification.create({
    data: { userId, title, body, type, data },
  });
  if (initialized && user?.fcmToken) {
    try {
      await admin.messaging().send({
        token: user.fcmToken,
        notification: { title, body },
        data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      });
    } catch (e) {
      logger.warn(`FCM send failed for user ${userId}: ${e.message}`);
    }
  }
  return notif;
}

module.exports = { pushToUser };
