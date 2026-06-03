const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/sosController');

router.use(authenticate);

router.post('/', ctrl.trigger);                                                                  // any employee can trigger
router.get('/', authorize('MANAGER', 'COMPANY_ADMIN', 'SUPER_ADMIN'), ctrl.list);                // manager+ list
router.post('/:id/acknowledge', authorize('MANAGER', 'COMPANY_ADMIN', 'SUPER_ADMIN'), ctrl.acknowledge);
router.post('/:id/resolve',     authorize('MANAGER', 'COMPANY_ADMIN', 'SUPER_ADMIN'), ctrl.resolve);

module.exports = router;
