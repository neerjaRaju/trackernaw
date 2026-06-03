const router = require('express').Router();
const ctrl = require('../controllers/authController');

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);
router.post('/otp/request', ctrl.requestOtp);
router.post('/otp/verify', ctrl.verifyOtp);

// SSO (Azure AD / Salesforce via OIDC) — see services/ssoService.js for config
router.use('/sso', require('./sso'));

module.exports = router;
