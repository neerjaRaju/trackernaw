const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/locationController');

router.use(authenticate);

router.post('/update', ctrl.update);
router.get('/live', ctrl.live);
router.get('/history/:userId', ctrl.history);
router.get('/route/:userId', ctrl.route);

module.exports = router;
