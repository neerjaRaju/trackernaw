const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/orderController');

router.use(authenticate);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.detail);
router.put('/:id/status', ctrl.updateStatus);

module.exports = router;
