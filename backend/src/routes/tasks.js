const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/taskController');

router.use(authenticate);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.detail);
router.put('/:id', ctrl.update);
router.post('/:id/complete', ctrl.complete);
router.post('/:id/comments', ctrl.comment);

module.exports = router;
