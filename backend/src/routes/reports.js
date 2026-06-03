const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const reportService = require('../services/reportService');

router.use(authenticate, authorize('MANAGER', 'COMPANY_ADMIN', 'SUPER_ADMIN'));

// JSON for the admin Reports page
router.get('/daily', async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const rows = await reportService.dailySummary(req.user.companyId, date);
    res.json({ date, rows });
  } catch (e) { next(e); }
});

// CSV for payroll
router.get('/daily.csv', async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const rows = await reportService.dailySummary(req.user.companyId, date);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="daily-${date}.csv"`);
    res.send(reportService.toCsv(rows));
  } catch (e) { next(e); }
});

// PDF for archive / printout
router.get('/daily.pdf', async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const rows = await reportService.dailySummary(req.user.companyId, date);
    const buf = await reportService.toPdf(rows, date);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="daily-${date}.pdf"`);
    res.send(buf);
  } catch (e) { next(e); }
});

module.exports = router;
