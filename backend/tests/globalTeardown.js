// Runs once after the entire test run completes.
// Wipes every table and disconnects every external resource so Jest exits clean.
module.exports = async () => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    // Order matters because of foreign keys — children before parents.
    await prisma.webhookDelivery.deleteMany();
    await prisma.webhook.deleteMany();
    await prisma.formSubmission.deleteMany();
    await prisma.formTemplate.deleteMany();
    await prisma.message.deleteMany();
    await prisma.sosAlert.deleteMany();
    await prisma.leaveRequest.deleteMany();
    await prisma.consent.deleteMany();
    await prisma.erasureRequest.deleteMany();
    await prisma.locationPing.deleteMany();
    await prisma.attendance.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.taskComment.deleteMany();
    await prisma.task.deleteMany();
    await prisma.expense.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.visit.deleteMany();
    await prisma.product.deleteMany();
    await prisma.dealer.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.geofence.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany();
    await prisma.team.deleteMany();
    await prisma.company.deleteMany();
  } finally {
    await prisma.$disconnect();
  }

  // Flush the test Redis database (DB 15 by convention) and close the socket.
  try {
    const Redis = require('ioredis');
    const r = new Redis(process.env.REDIS_URL || 'redis://localhost:6379/15');
    await r.flushdb();
    r.disconnect();
  } catch (e) {
    // Redis cleanup is best-effort — don't block test exit on it.
  }
};
