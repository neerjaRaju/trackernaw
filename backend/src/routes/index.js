const router = require('express').Router();

router.use('/auth', require('./auth'));
router.use('/attendance', require('./attendance'));
router.use('/location', require('./location'));
router.use('/tasks', require('./tasks'));
router.use('/expenses', require('./expenses'));
router.use('/orders', require('./orders'));
router.use('/visits', require('./visits'));
router.use('/users', require('./users'));
router.use('/dashboard', require('./dashboard'));
router.use('/messages', require('./messages'));
router.use('/sos', require('./sos'));
router.use('/reports', require('./reports'));
router.use('/geofences', require('./geofences'));
router.use('/me', require('./me'));
router.use('/uploads', require('./uploads'));
router.use('/leaves', require('./leaves'));
router.use('/forms', require('./forms'));
router.use('/webhooks', require('./webhooks'));
router.use('/audit', require('./audit'));
router.use('/companies', require('./companies'));

module.exports = router;
