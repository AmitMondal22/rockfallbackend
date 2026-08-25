require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');

const { sequelize, connectDB } = require('./config/database');
const { Organization, Project, User, Location, Device, Asset } = require('./db/models');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { initWebSocketServer } = require('./websocket/wsServer');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS & Body Parsers
const corsOptions = {
  origin: (origin, callback) => callback(null, true),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Logging
app.use((req, res, next) => {
  if (!req.url.includes('/health')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'unified-service',
    timestamp: new Date().toISOString()
  });
});

// Hardware GET endpoint fallback (Direct device URL support: /api/new/4G2)
const { handleHttpGetTelemetry } = require('./controllers/telemetryController');
app.get('/api/new/4G2', handleHttpGetTelemetry);

// Mount Central API Routes
app.use('/api', routes);

// Global Error Handler
app.use(errorHandler);

// HTTP Server & WebSocket Attachment
const server = http.createServer(app);
initWebSocketServer(server);

// Start Server Function
const startServer = async () => {
  try {
    await connectDB();
    try {
      await sequelize.sync({ alter: true });
      console.log('[Sequelize] Models synchronized with PostgreSQL database.');
    } catch (syncErr) {
      console.warn('[Sequelize Sync Warning]:', syncErr.message);
      await sequelize.sync();
      console.log('[Sequelize] Basic model synchronization completed.');
    }

    // Seed default organization and initial admin if not existing
    const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@rockfall.com';
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'admin123';
    
    let defaultOrg = await Organization.findByPk('org_default');
    if (!defaultOrg) {
      defaultOrg = await Organization.create({
        id: 'org_default',
        name: 'RockFall Main Organization',
        description: 'Primary organization for RockFall monitoring system'
      });
      console.log('[Seed] Created default organization (org_default).');
    }

    // Seed default Project
    let defaultProject = await Project.findByPk('prj_kuppavalasa');
    if (!defaultProject) {
      defaultProject = await Project.create({
        id: 'prj_kuppavalasa',
        name: 'Kuppavalasa Slope Stabilization Project',
        org_id: 'org_default',
        description: 'Comprehensive rockfall detection and slope stabilization monitoring for Kuppavalasa railway and roadway corridor.',
        status: 'ACTIVE',
        client_name: 'Infrastructure & Railway Division',
        start_date: new Date('2026-01-01')
      });
      console.log('[Seed] Created default project (prj_kuppavalasa).');
    }

    // Link existing location to project if not set
    await Location.update({ project_id: 'prj_kuppavalasa', org_id: 'org_default' }, { where: { project_id: null } });
    await Asset.update({ project_id: 'prj_kuppavalasa', org_id: 'org_default' }, { where: { project_id: null } });
    await Device.update({ project_id: 'prj_kuppavalasa', org_id: 'org_default' }, { where: { project_id: null } });

    server.listen(PORT, () => {
      console.log(`======================================================`);
      console.log(`🚀 Unified Rockfall Backend Service running on port ${PORT}`);
      console.log(`📡 WebSocket server listening on ws://localhost:${PORT}/ws`);
      console.log(`📡 Hardware GET telemetry: http://localhost:${PORT}/api/new/4G2`);
      console.log(`📡 LoRaWAN Webhook: http://localhost:${PORT}/api/lorawan/webhook`);
      console.log(`======================================================`);
    });
  } catch (error) {
    console.error('[Server Startup Error]:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = { app, server };
