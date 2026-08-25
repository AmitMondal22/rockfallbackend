const express = require('express');
const router = express.Router();
const historicalController = require('../controllers/historicalController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/analytics/summary', historicalController.getAnalyticsSummary);
router.get('/analytics', historicalController.getHistoricalAnalytics);
router.get('/events/counts', historicalController.getEventCountsByType);
router.get('/events/export', historicalController.exportCsv);
router.get('/reports/generate', historicalController.generateReport);
router.get('/stats/:deviceId', historicalController.getStats);
router.get('/events/:deviceId?', historicalController.getEvents);
router.get('/alerts/:deviceId?', historicalController.getAlerts);

module.exports = router;
