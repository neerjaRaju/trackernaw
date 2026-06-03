const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/companyController');

router.use(authenticate, authorize('SUPER_ADMIN'));

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.post('/:id/promote-admin', ctrl.promoteAdmin);
router.post('/:id/demote-admin', ctrl.demoteAdmin);

module.exports = router;
