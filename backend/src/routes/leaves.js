const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/leaveController');

router.use(authenticate);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/balance', ctrl.balance);
router.post('/:id/decide', authorize('MANAGER', 'TEAM_LEAD', 'COMPANY_ADMIN', 'SUPER_ADMIN'), ctrl.decide);
router.post('/:id/cancel', ctrl.cancel);

module.exports = router;
