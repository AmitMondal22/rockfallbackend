const express = require('express');
const router = express.Router();
const telemetryController = require('../controllers/telemetryController');
const { authenticate } = require('../middleware/authMiddleware');

// Hardware GET Telemetry Endpoints (Unauthenticated hardware access)
router.get('/api/new/4G2', telemetryController.handleHttpGetTelemetry);
router.get('/new/4G2', telemetryController.handleHttpGetTelemetry);
router.get('/http', telemetryController.handleHttpGetTelemetry);

// Dashboard Query Endpoints (Authenticated)
router.get('/history', authenticate, telemetryController.getTelemetryHistory);
router.get('/latest/:deviceId', authenticate, telemetryController.getLatestDeviceTelemetry);

module.exports = router;
