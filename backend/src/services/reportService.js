const prisma = require('../utils/prisma');
const { haversineMeters } = require('./geofenceService');

/**
 * Aggregate one day of activity per agent for a company.
 * Returns rows of: { userId, fullName, checkIn, checkOut, workMinutes, distanceKm,
 *                    tasksCompleted, visits, expenseAmount, faceVerified, withinGeofence }
 */
async function dailySummary(companyId, dateStr) {
  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);
  const next = new Date(date.getTime() + 24 * 3600_000);

  const users = await prisma.user.findMany({
    where: { companyId, isActive: true },
    select: { id: true, fullName: true, email: true, role: true },
  });

  const rows = await Promise.all(users.map(async (u) => {
    const [att, pings, tasks, visits, expenses] = await Promise.all([
      prisma.attendance.findUnique({ where: { userId_date: { userId: u.id, date } } }),
      prisma.locationPing.findMany({
        where: { userId: u.id, recordedAt: { gte: date, lt: next } },
        orderBy: { recordedAt: 'asc' },
        select: { lat: true, lng: true },
      }),
      prisma.task.count({ where: { assigneeId: u.id, completedAt: { gte: date, lt: next } } }),
      prisma.visit.count({ where: { userId: u.id, checkInAt: { gte: date, lt: next } } }),
      prisma.expense.aggregate({
        where: { userId: u.id, createdAt: { gte: date, lt: next } },
        _sum: { amount: true },
      }),
    ]);

    // Compute distance from consecutive pings
    let distanceM = 0;
    for (let i = 1; i < pings.length; i++) {
      distanceM += haversineMeters(pings[i - 1].lat, pings[i - 1].lng, pings[i].lat, pings[i].lng);
    }

    return {
      userId: u.id,
      fullName: u.fullName,
      email: u.email,
      role: u.role,
      checkIn: att?.checkInAt || null,
      checkOut: att?.checkOutAt || null,
      workMinutes: att?.workMinutes ?? null,
      distanceKm: +(distanceM / 1000).toFixed(2),
      tasksCompleted: tasks,
      visits,
      expenseAmount: Number(expenses._sum.amount || 0),
      faceVerified: !!att?.faceVerified,
      withinGeofence: !!att?.withinGeofence,
    };
  }));

  return rows;
}

function toCsv(rows) {
  const cols = ['fullName', 'email', 'role', 'checkIn', 'checkOut', 'workMinutes',
                'distanceKm', 'tasksCompleted', 'visits', 'expenseAmount',
                'faceVerified', 'withinGeofence'];
  const header = cols.join(',');
  const body = rows.map((r) => cols.map((c) => {
    const v = r[c];
    if (v == null) return '';
    if (v instanceof Date) return v.toISOString();
    const s = String(v);
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  return header + '\n' + body + '\n';
}

async function toPdf(rows, dateStr) {
  // pdfkit is loaded lazily so the rest of the API runs even if it's not installed yet
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  doc.fontSize(18).text(`Daily Field Force Summary`, { align: 'left' });
  doc.fontSize(11).fillColor('#555').text(`Date: ${dateStr}`, { align: 'left' });
  doc.moveDown();

  // Simple table
  doc.fillColor('#000').fontSize(9);
  const headers = ['Employee', 'In', 'Out', 'Min', 'Km', 'Tasks', 'Visits', 'Expense'];
  const colWidths = [120, 70, 70, 35, 40, 40, 40, 60];

  function row(values, isHeader = false) {
    const y = doc.y;
    let x = 40;
    values.forEach((v, i) => {
      doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
         .text(String(v ?? ''), x, y, { width: colWidths[i], lineBreak: false });
      x += colWidths[i];
    });
    doc.moveDown(0.6);
  }
  row(headers, true);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();

  rows.forEach((r) => {
    row([
      r.fullName,
      r.checkIn ? new Date(r.checkIn).toTimeString().slice(0, 5) : '—',
      r.checkOut ? new Date(r.checkOut).toTimeString().slice(0, 5) : '—',
      r.workMinutes ?? '—',
      r.distanceKm,
      r.tasksCompleted,
      r.visits,
      r.expenseAmount,
    ]);
  });

  doc.moveDown();
  doc.fontSize(8).fillColor('#777').text(
    `Generated ${new Date().toISOString()} · Real-GPS verified only · Face verification: ${rows.filter(r => r.faceVerified).length}/${rows.length}`,
    { align: 'center' }
  );

  doc.end();
  return done;
}

module.exports = { dailySummary, toCsv, toPdf };
