const { WebSocketServer, WebSocket } = require('ws');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'rockfall-secret-jwt-key';

let wss = null;
const clients = new Set();

const initWebSocketServer = (server) => {
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname.includes('/ws')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws, req) => {
    console.log('[WebSocket] Client connected from', req.socket.remoteAddress);
    clients.add(ws);

    // Send connection success message
    ws.send(JSON.stringify({
      type: 'connection_established',
      event: 'connection_established',
      message: 'Connected to Rockfall Realtime WebSocket Service',
      timestamp: new Date().toISOString()
    }));

    ws.on('message', (message) => {
      try {
        const payload = JSON.parse(message.toString());
        if (payload.action === 'ping' || payload.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
      } catch (e) {
        // Ignore non-json or unparseable client messages
      }
    });

    ws.on('close', () => {
      console.log('[WebSocket] Client disconnected');
      clients.delete(ws);
    });

    ws.on('error', (err) => {
      console.warn('[WebSocket Error]', err.message);
      clients.delete(ws);
    });
  });

  console.log('[WebSocket] Server initialized on path /ws');
};

const broadcast = (payload) => {
  const json = JSON.stringify(payload);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  });
};

module.exports = {
  initWebSocketServer,
  broadcast
};
