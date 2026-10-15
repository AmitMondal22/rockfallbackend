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

const path = require('path');

// Ensure uploads directories exist
const uploadDir = path.join(__dirname, 'uploads', 'logos');
const fs = require('fs');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

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

    // Create initial super admin only if specified and not already present
    const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
    if (adminEmail && adminPassword) {
      const existingAdmin = await User.findOne({ where: { email: adminEmail } });
      if (!existingAdmin) {
        await User.create({
          id: `usr_admin_${Date.now()}`,
          name: 'Super Admin',
          email: adminEmail,
          password: adminPassword,
          role: 'SUPER_ADMIN'
        });
        console.log(`[Admin] Initial Super Admin account created: ${adminEmail}`);
      }
    }

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
