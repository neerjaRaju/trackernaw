const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/meController');

router.use(authenticate);

// DPDP data-subject endpoints
router.get('/consent', ctrl.consentLog);
router.post('/consent', ctrl.recordConsent);
router.get('/export', ctrl.exportData);
router.post('/erasure', ctrl.requestErasure);

module.exports = router;
