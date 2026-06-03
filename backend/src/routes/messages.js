const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/messageController');

router.use(authenticate);

router.get('/conversations', ctrl.conversations);
router.get('/:peerId', ctrl.history);
router.post('/', ctrl.send);
router.post('/:peerId/read', ctrl.markRead);

module.exports = router;
