const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const validate = require('../middleware/validateMiddleware');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { createAlertRuleSchema } = require('../validators/alertValidator');

router.use(authenticate);

// Alert Rules endpoints (must come before /:id parameter matching)
router.get('/rules', alertController.getAlertRules);
router.post('/rules', authorize('SUPER_ADMIN', 'ORG_ADMIN'), validate(createAlertRuleSchema), alertController.createAlertRule);
router.put('/rules/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN'), alertController.updateAlertRule);
router.delete('/rules/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN'), alertController.deleteAlertRule);

// Alerts log endpoints
router.get('/', alertController.getActiveAlerts);
router.get('/logs', alertController.getActiveAlerts);
router.put('/:id/acknowledge', alertController.acknowledgeAlert);
router.put('/logs/:id/acknowledge', alertController.acknowledgeAlert);
router.put('/:id/resolve', alertController.resolveAlert);
router.put('/logs/:id/resolve', alertController.resolveAlert);

module.exports = router;
