const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/expenseController');

router.use(authenticate);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.post('/ocr', ctrl.ocr);
router.post('/:id/approve', authorize('MANAGER', 'COMPANY_ADMIN', 'SUPER_ADMIN'), ctrl.approve);
router.post('/:id/reject', authorize('MANAGER', 'COMPANY_ADMIN', 'SUPER_ADMIN'), ctrl.reject);

module.exports = router;
