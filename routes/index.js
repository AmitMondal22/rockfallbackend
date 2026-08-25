const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const orgRoutes = require('./orgRoutes');
const projectRoutes = require('./projectRoutes');
const locationRoutes = require('./locationRoutes');
const deviceRoutes = require('./deviceRoutes');
const assetRoutes = require('./assetRoutes');
const telemetryRoutes = require('./telemetryRoutes');
const lorawanRoutes = require('./lorawanRoutes');
const alertRoutes = require('./alertRoutes');
const historicalRoutes = require('./historicalRoutes');
const notificationRoutes = require('./notificationRoutes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/organizations/locations', locationRoutes);
router.use('/organizations', orgRoutes);
router.use('/projects', projectRoutes);
router.use('/locations', locationRoutes);
router.use('/devices/assets', assetRoutes);
router.use('/assets', assetRoutes);
router.use('/devices', deviceRoutes);
router.use('/telemetry', telemetryRoutes);
router.use('/lorawan', lorawanRoutes);
router.use('/alerts', alertRoutes);
router.use('/historical', historicalRoutes);
router.use('/notifications', notificationRoutes);

// Compatibility fallback for hardware GET requests on /api/new/4G2
router.get('/new/4G2', telemetryRoutes);

module.exports = router;
