const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/attendanceController');

router.use(authenticate);

router.post('/checkin', ctrl.checkIn);
router.post('/checkout', ctrl.checkOut);
router.get('/today', ctrl.today);
router.get('/history', ctrl.history);
router.get('/team', ctrl.teamAttendance);

module.exports = router;
