const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/formController');

router.use(authenticate);

router.get('/templates', ctrl.listTemplates);
router.get('/templates/:id', ctrl.getTemplate);
router.post('/templates', authorize('COMPANY_ADMIN', 'SUPER_ADMIN'), ctrl.createTemplate);
router.post('/templates/:id/deactivate', authorize('COMPANY_ADMIN', 'SUPER_ADMIN'), ctrl.deactivate);

router.post('/submit', ctrl.submit);
router.get('/submissions', ctrl.listSubmissions);
router.get('/submissions/:id', ctrl.getSubmission);

module.exports = router;
