const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const assetController = require('../controllers/assetController');
const validate = require('../middleware/validateMiddleware');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { createDeviceSchema, updateDeviceThresholdSchema } = require('../validators/deviceValidator');

// Public threshold endpoint for devices
router.get('/threshold/:id', deviceController.getDeviceThreshold);

// Authenticated routes
router.use(authenticate);

// --- DEVICE ROUTES ---
router.get('/', deviceController.getAllDevices);
router.post('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'PROJECT_ADMIN', 'PROJECT_USER', 'LOCATION_USER', 'SITE_USER', 'ASSET_USER', 'USER'), validate(createDeviceSchema), deviceController.createDevice);
router.get('/:id/asset', assetController.getDeviceAsset);
router.get('/:id', deviceController.getDeviceById);
router.put('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'PROJECT_ADMIN', 'PROJECT_USER', 'LOCATION_USER', 'SITE_USER'), deviceController.updateDevice);
router.put('/:id/location', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'PROJECT_ADMIN', 'PROJECT_USER', 'LOCATION_USER', 'SITE_USER'), deviceController.updateDevice);
router.put('/:id/threshold', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'PROJECT_ADMIN', 'PROJECT_USER'), validate(updateDeviceThresholdSchema), deviceController.updateDeviceThreshold);
router.delete('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'PROJECT_ADMIN', 'PROJECT_USER'), deviceController.deleteDevice);

module.exports = router;
