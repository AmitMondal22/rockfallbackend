const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', locationController.getAllLocations);
router.get('/:id', locationController.getLocationById);
router.post('/', authorize('SUPER_ADMIN', 'ORG_ADMIN'), locationController.createLocation);
router.put('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN'), locationController.updateLocation);
router.delete('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN'), locationController.deleteLocation);

module.exports = router;
