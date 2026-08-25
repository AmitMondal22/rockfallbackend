const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/logs', notificationController.getNotificationLogs);
router.post('/resend', notificationController.resendNotification);

module.exports = router;
