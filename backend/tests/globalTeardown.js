// Runs once after the entire test run completes.
// Wipes every table (FK-safe order) so the test DB is clean for the next run.
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
};
