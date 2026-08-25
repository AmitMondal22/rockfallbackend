const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assetController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// Authenticated routes
router.use(authenticate);

// List inventory
router.get('/list', assetController.getInventory);
router.get('/', assetController.getInventory);

// Create new barrier asset
router.post('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'PROJECT_ADMIN', 'PROJECT_USER', 'LOCATION_USER', 'SITE_USER'), assetController.createAsset);

// Device management under asset
router.get('/:id/available-devices', assetController.getAvailableDevices);
router.put('/:assetId/devices/:deviceId', assetController.attachDevice);
router.delete('/:assetId/devices/:deviceId', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'PROJECT_ADMIN', 'PROJECT_USER'), assetController.detachDevice);

// Analysis endpoint (registered BEFORE :id)
router.get('/:id/analysis', assetController.getAssetAnalysis);

// Specific asset CRUD
router.get('/:id', assetController.getAssetById);
router.put('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'PROJECT_ADMIN', 'PROJECT_USER', 'LOCATION_USER', 'SITE_USER'), assetController.updateAsset);
router.delete('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'PROJECT_ADMIN', 'PROJECT_USER'), assetController.deleteAsset);

module.exports = router;
