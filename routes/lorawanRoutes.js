const express = require('express');
const router = express.Router();
const lorawanController = require('../controllers/lorawanController');

// 2-Way LoRaWAN Webhook endpoints (Public for Network Server calls)
router.post('/webhook', lorawanController.handleLoRaWANWebhook);
router.post('/telemetry', lorawanController.handleLoRaWANWebhook);
router.post('/uplink', lorawanController.handleLoRaWANWebhook);

module.exports = router;
